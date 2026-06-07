import { ErrorFn, ErrorMeta } from './types';

export const THROWS_METADATA_KEY = 'defineErrors:throws';

// Lazy singleton — resolved once on first @Throws decoration, then cached.
// Avoids a require() call per handler while keeping @nestjs/swagger optional.
let _ApiResponse: ((opts: object) => MethodDecorator) | null | undefined;

function getApiResponse(): ((opts: object) => MethodDecorator) | null {
  if (_ApiResponse !== undefined) return _ApiResponse;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _ApiResponse = require('@nestjs/swagger').ApiResponse ?? null;
  } catch {
    _ApiResponse = null;
  }
  // TypeScript cannot narrow through try/catch — cast is safe: both branches assign.
  return _ApiResponse as ((opts: object) => MethodDecorator) | null;
}

/**
 * Declares which RegistryErrors a route can throw.
 * Does two things at decoration time:
 *   1. Merges into existing Reflect metadata so stacked @Throws decorators
 *      accumulate rather than overwrite each other.
 *   2. Injects @ApiResponse decorators for each error into the Swagger document,
 *      including an RFC 7807-compliant response schema.
 *
 * @example
 * @Get(':id')
 * @Throws(UserErrors.NOT_FOUND, UserErrors.EMAIL_TAKEN)
 * async getUser(@Param('id') id: string) { ... }
 */
export function Throws(...errors: ErrorFn<any>[]): MethodDecorator {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    const incoming = errors.map((e) => e._meta);

    // Merge with any metadata already set by a prior @Throws on this handler.
    // Decorators apply bottom-up, so each application must accumulate rather
    // than overwrite to avoid silent data loss when stacking decorators.
    const existing: ErrorMeta[] =
      Reflect.getMetadata(THROWS_METADATA_KEY, descriptor.value) ?? [];
    const merged = [...existing, ...incoming];

    // NestJS Reflector reads from descriptor.value (the handler function itself)
    Reflect.defineMetadata(THROWS_METADATA_KEY, merged, descriptor.value);
    applySwaggerResponses(incoming, target, key, descriptor);
  };
}

function applySwaggerResponses(
  metas: ErrorMeta[],
  target: object,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  const ApiResponse = getApiResponse();
  if (!ApiResponse) return;

  // Group by status so multiple errors with the same status get merged
  const byStatus = new Map<number, ErrorMeta[]>();
  for (const meta of metas) {
    const group = byStatus.get(meta.status) ?? [];
    group.push(meta);
    byStatus.set(meta.status, group);
  }

  for (const [status, group] of byStatus) {
    const description = group
      .map((m) => `**${escapeHtml(m.code)}** — ${escapeHtml(m.title ?? m.code)}`)
      .join('<br>');

    const schema = buildRfc7807Schema(group);

    ApiResponse({ status, description, schema })(target, key, descriptor);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRfc7807Schema(metas: ErrorMeta[]): object {
  const firstStatus = metas[0].status;
  const codeEnum = metas.map((m) => m.code);

  return {
    type: 'object',
    required: ['type', 'title', 'status', 'detail', 'instance', 'timestamp'],
    properties: {
      type: {
        type: 'string',
        description: 'URI reference identifying the error type',
        example: `https://example.com/errors/${codeEnum[0]}`,
      },
      title: {
        type: 'string',
        description: 'Short human-readable summary',
        example: metas[0].title ?? metas[0].code,
      },
      status: {
        type: 'integer',
        example: firstStatus,
      },
      detail: {
        type: 'string',
        description: 'Human-readable explanation specific to this occurrence',
      },
      instance: {
        type: 'string',
        description: 'URI reference of the specific occurrence',
        example: '/users/123e4567-e89b-12d3-a456-426614174000',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        // Static example — avoids freezing the server boot time in Swagger UI.
        example: '2024-01-15T10:30:00.000Z',
      },
      code: {
        type: 'string',
        enum: codeEnum,
        description: 'Machine-readable error code',
      },
    },
  };
}
