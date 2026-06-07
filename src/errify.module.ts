import { APP_FILTER } from '@nestjs/core';
import { DynamicModule, Module } from '@nestjs/common';
import { ErrifyExceptionFilter, ErrifyFilterOptions } from './errify.filter';

export interface ErrifyModuleOptions extends ErrifyFilterOptions {}

/**
 * Import once in your root AppModule.
 *
 * @example
 * @Module({
 *   imports: [
 *     ErrifyModule.forRoot({ baseUrl: 'https://api.example.com' }),
 *   ],
 * })
 * export class AppModule {}
 */
@Module({})
export class ErrifyModule {
  static forRoot(options: ErrifyModuleOptions = {}): DynamicModule {
    return {
      module: ErrifyModule,
      providers: [
        {
          provide: APP_FILTER,
          useValue: new ErrifyExceptionFilter(options),
        },
      ],
    };
  }
}
