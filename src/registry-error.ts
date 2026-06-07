import { HttpException } from '@nestjs/common';
import { ErrorMeta } from './types';

export class RegistryError extends HttpException {
  constructor(
    public readonly meta: ErrorMeta,
    public readonly detail: string,
    public readonly errorKey: string,
  ) {
    super(
      {
        code: meta.code,
        title: meta.title ?? meta.code,
        detail,
        status: meta.status,
      },
      meta.status,
    );
  }
}
