import { ErrifyError } from './errify-error';
import { ErrorDefinition, ErrorMeta, ErrifyFn, ErrifyMap } from './types';

/**
 * Creates a typed error catalog. Each key becomes a callable that throws an
 * ErrifyError with RFC 7807-compatible metadata.
 *
 * @example
 * export const UserErrors = errify({
 *   NOT_FOUND: {
 *     status: 404,
 *     code: 'USR-404',
 *     title: 'User Not Found',
 *     message: (id: string) => `User with id ${id} not found`,
 *   },
 *   EMAIL_TAKEN: {
 *     status: 409,
 *     code: 'USR-409',
 *     title: 'Email Already Taken',
 *     message: 'Email already in use',
 *   },
 * });
 *
 * // In your service:
 * throw UserErrors.NOT_FOUND(userId);   // TypeScript infers (id: string)
 * throw UserErrors.EMAIL_TAKEN();       // TypeScript infers ()
 *
 * // In your controller (Swagger integration):
 * @Throws(UserErrors.NOT_FOUND, UserErrors.EMAIL_TAKEN)
 * async getUser(@Param('id') id: string) { ... }
 */
export function errify<T extends Record<string, ErrorDefinition<any>>>(
  definitions: T,
): ErrifyMap<T> {
  const result = {} as ErrifyMap<T>;

  for (const [key, def] of Object.entries(definitions) as [string, ErrorDefinition<any>][]) {
    const meta: ErrorMeta = {
      status: def.status,
      code: def.code,
      title: def.title,
      messageTemplate: def.message,
    };

    const fn = ((...args: unknown[]): never => {
      const detail =
        typeof def.message === 'function'
          ? def.message(...args)
          : def.message;
      throw new ErrifyError(meta, detail, key);
    }) as ErrifyFn<any>;

    Object.defineProperty(fn, '_meta', { value: meta, writable: false, enumerable: true });

    (result as Record<string, ErrifyFn<any>>)[key] = fn;
  }

  return result;
}
