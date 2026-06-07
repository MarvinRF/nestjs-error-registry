import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrifyError } from './errify-error';

export interface ErrifyFilterOptions {
  /**
   * Base URL used to construct the RFC 7807 `type` URI.
   * Example: 'https://api.example.com'
   * Result: 'https://api.example.com/errors/USR-404'
   * @default ''  (relative URI: '/errors/USR-404')
   */
  baseUrl?: string;

  /**
   * When true, non-ErrifyError HttpExceptions are passed through to the next
   * exception filter in the chain instead of being handled here.
   * @default true
   */
  passthrough?: boolean;
}

/**
 * Exception filter that catches ErrifyErrors and formats them as RFC 7807
 * Problem Details (https://www.rfc-editor.org/rfc/rfc7807).
 *
 * Registered automatically by ErrifyModule.forRoot(). Non-ErrifyError exceptions
 * are passed through to the default NestJS exception filter unless passthrough is false.
 */
@Catch()
export class ErrifyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrifyExceptionFilter.name);

  constructor(private readonly options: ErrifyFilterOptions = {}) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!(exception instanceof ErrifyError)) {
      // Pass through — let the default NestJS handler deal with it
      if (this.options.passthrough !== false && exception instanceof HttpException) {
        const status = exception.getStatus();
        const body = exception.getResponse();
        response.status(status).json(body);
        return;
      }
      // Unknown errors — 500
      this.logger.error('Unhandled exception', exception);
      response.status(500).json({
        type: this.buildTypeUri('INTERNAL_SERVER_ERROR'),
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
        instance: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { meta, detail } = exception;
    const body: Record<string, unknown> = {
      type: this.buildTypeUri(meta.code),
      title: meta.title ?? meta.code,
      status: meta.status,
      detail,
      instance: request.url,
      timestamp: new Date().toISOString(),
      code: meta.code,
    };

    response
      .status(meta.status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(body);
  }

  private buildTypeUri(code: string): string {
    const base = (this.options.baseUrl ?? '').replace(/\/+$/, '');
    return `${base}/errors/${code}`;
  }
}
