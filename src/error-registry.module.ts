import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { ErrorRegistryFilter, ErrorRegistryOptions } from './error-registry.filter';

export interface ErrorRegistryModuleOptions extends ErrorRegistryOptions {}

/**
 * Import once in your root AppModule.
 *
 * @example
 * @Module({
 *   imports: [
 *     ErrorRegistryModule.forRoot({ baseUrl: 'https://api.example.com' }),
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class ErrorRegistryModule {
  static forRoot(options: ErrorRegistryModuleOptions = {}): DynamicModule {
    return {
      module: ErrorRegistryModule,
      providers: [
        {
          provide: APP_FILTER,
          // useFactory (not useValue) so NestJS injects HttpAdapterHost, enabling
          // BaseExceptionFilter to truly delegate non-RegistryError exceptions
          // rather than re-implementing default NestJS handling inline.
          useFactory: (adapterHost: HttpAdapterHost) =>
            new ErrorRegistryFilter(options, adapterHost.httpAdapter),
          inject: [HttpAdapterHost],
        },
      ],
    };
  }
}
