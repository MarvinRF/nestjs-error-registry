import { APP_FILTER } from '@nestjs/core';
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
          useValue: new ErrorRegistryFilter(options),
        },
      ],
    };
  }
}
