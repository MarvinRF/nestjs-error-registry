import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { RegistryError } from './registry-error';

export interface ErrorRegistryOptions {
  /**
   * Base URL used to construct the RFC 7807 `type` URI.
   * Example: 'https://example.com'
   * Result: 'https://example.com/errors/USR-404'
   * @default ''  (relative URI: '/errors/USR-404')
   */
  baseUrl?: string;

  /**
   * When true (default), non-RegistryError exceptions are delegated to
   * NestJS's BaseExceptionFilter — preserving the behaviour of any other
   * global filters registered in the application.
   * When false, all unhandled exceptions are returned as a generic 500.
   * @default true
   */
  passthrough?: boolean;
}

/**
 * Exception filter that catches RegistryErrors and formats them as RFC 7807
 * Problem Details (https://www.rfc-editor.org/rfc/rfc7807).
 *
 * Registered automatically by ErrorRegistryModule.forRoot(). Non-RegistryError
 * exceptions are delegated to BaseExceptionFilter (true passthrough) unless
 * passthrough is explicitly set to false.
 *
 * IMPORTANT: Instantiate via ErrorRegistryModule.forRoot() so the underlying
 * HttpAdapter is injected correctly. Direct instantiation (new ErrorRegistryFilter())
 * is supported for unit-testing buildTypeUri but will not delegate passthrough
 * correctly without an httpAdapter argument.
 */
@Catch()
export class ErrorRegistryFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ErrorRegistryFilter.name);

  constructor(
    private readonly options: ErrorRegistryOptions = {},
    httpAdapter?: AbstractHttpAdapter,
  ) {
    super(httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof RegistryError)) {
      if (this.options.passthrough !== false) {
        // True delegation — BaseExceptionFilter handles HttpExceptions in NestJS
        // format and unknown errors as 500, preserving the full filter chain.
        super.catch(exception, host);
        return;
      }

      // passthrough: false — absorb all non-Registry exceptions as a generic 500.
      this.logger.error('Unhandled exception', exception);
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      response.status(500).json({
        type: this.buildTypeUri('INTERNAL_SERVER_ERROR'),
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
        instance: sanitizeUrl(request.url),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const instance = sanitizeUrl(request.url);

    const { meta, detail } = exception;
    const body: Record<string, unknown> = {
      type: this.buildTypeUri(meta.code),
      title: meta.title ?? meta.code,
      status: meta.status,
      detail,
      instance,
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

const MAX_INSTANCE_LENGTH = 512;

function sanitizeUrl(url: string): string {
  // Strip ASCII control characters (0x00–0x1F and 0x7F) to prevent log injection
  // and truncate to a safe length to prevent oversized responses.
  const stripped = url.replace(/[\x00-\x1F\x7F]/g, '');
  return stripped.length > MAX_INSTANCE_LENGTH
    ? stripped.slice(0, MAX_INSTANCE_LENGTH) + '…'
    : stripped;
}
