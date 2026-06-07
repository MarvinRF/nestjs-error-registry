export type MessageFactory<A extends unknown[]> = (...args: A) => string;

export interface ErrorDefinition<A extends unknown[] = []> {
  status: number;
  code: string;
  title?: string;
  message: string | MessageFactory<A>;
}

export interface ErrorMeta {
  status: number;
  code: string;
  title?: string;
  messageTemplate: string | MessageFactory<any[]>;
}

/** A callable that throws an RegistryError. Return type is `never` so TypeScript
 *  understands control flow terminates here — no explicit `throw` needed,
 *  though `throw UserErrors.NOT_FOUND('id')` is also idiomatic and clear. */
export type ErrorFn<A extends unknown[]> = ((...args: A) => never) & {
  readonly _meta: ErrorMeta;
};

type InferArgs<T extends ErrorDefinition<any>> =
  T extends ErrorDefinition<infer A> ? A : [];

export type ErrorMap<T extends Record<string, ErrorDefinition<any>>> = {
  readonly [K in keyof T]: ErrorFn<InferArgs<T[K]>>;
};
