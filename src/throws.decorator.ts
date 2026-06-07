import { ErrifyFn, ErrorMeta } from './types';

export const THROWS_METADATA_KEY = 'errify:throws';

/**
 * Declares which ErrifyErrors a route can throw.
 * Does two things at decoration time:
 *   1. Sets Reflect metadata so tooling and tests can inspect declared errors.
 *   2. Injects @ApiResponse decorators for each error into the Swagger document,
 *      including an RFC 7807-compliant response schema.
 *
 * @example
 * @Get(':id')
 * @Throws(UserErrors.NOT_FOUND, UserErrors.EMAIL_TAKEN)
 * async getUser(@Param('id') id: string) { ... }
 */
export function Throws(...errors: ErrifyFn<any>[]): MethodDecorator {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    const metas = errors.map((e) => e._meta);
    // NestJS Reflector reads from descriptor.value (the handler function itself)
    Reflect.defineMetadata(THROWS_METADATA_KEY, metas, descriptor.value);
    applySwaggerResponses(metas, target, key, descriptor);
  };
}

function applySwaggerResponses(
  metas: ErrorMeta[],
  target: object,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  let ApiResponse: ((opts: object) => MethodDecorator) | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ApiResponse = require('@nestjs/swagger').ApiResponse;
  } catch {
    // @nestjs/swagger is optional — skip silently
    return;
  }

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
        example: `https://api.example.com/errors/${codeEnum[0]}`,
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
        example: new Date().toISOString(),
      },
      code: {
        type: 'string',
        enum: codeEnum,
        description: 'Machine-readable error code',
      },
    },
  };
}
