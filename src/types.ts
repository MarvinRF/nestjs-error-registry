// Union of all IANA-registered 4xx and 5xx HTTP status codes.
// Restricts ErrorDefinition.status at the type level — invalid codes are
// caught by the compiler rather than at runtime.
export type HttpErrorStatus =
  // 4xx Client Errors
  | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409
  | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421
  | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
  // 5xx Server Errors
  | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

export type MessageFactory<A extends unknown[]> = (...args: A) => string;

export interface ErrorDefinition<A extends unknown[] = []> {
  status: HttpErrorStatus;
  code: string;
  title?: string;
  message: string | MessageFactory<A>;
}

// Generic A preserves the message factory's argument types on _meta,
// preventing unchecked calls to messageTemplate from tooling or tests.
export interface ErrorMeta<A extends unknown[] = unknown[]> {
  status: HttpErrorStatus;
  code: string;
  title?: string;
  messageTemplate: string | MessageFactory<A>;
}

/** A callable that throws an RegistryError. Return type is `never` so TypeScript
 *  understands control flow terminates here — no explicit `throw` needed,
 *  though `throw UserErrors.NOT_FOUND('id')` is also idiomatic and clear. */
export type ErrorFn<A extends unknown[]> = ((...args: A) => never) & {
  readonly _meta: ErrorMeta<A>;
};

type InferArgs<T extends ErrorDefinition<any>> =
  T extends ErrorDefinition<infer A> ? A : [];

export type ErrorMap<T extends Record<string, ErrorDefinition<any>>> = {
  readonly [K in keyof T]: ErrorFn<InferArgs<T[K]>>;
};
