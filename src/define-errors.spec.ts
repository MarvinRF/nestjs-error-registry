import 'reflect-metadata';
import { defineErrors } from './define-errors';
import { RegistryError } from './registry-error';

const UserErrors = defineErrors({
  NOT_FOUND: {
    status: 404,
    code: 'USR-404',
    title: 'User Not Found',
    message: (id: string) => `User with id ${id} not found`,
  },
  EMAIL_TAKEN: {
    status: 409,
    code: 'USR-409',
    title: 'Email Already Taken',
    message: 'Email already in use',
  },
});

describe('defineErrors() — validation', () => {
  it('throws on status below 400', () => {
    expect(() => defineErrors({ E: { status: 200 as any, code: 'OK', message: 'ok' } }))
      .toThrow('Invalid status');
  });

  it('throws on status above 599', () => {
    expect(() => defineErrors({ E: { status: 600 as any, code: 'ERR', message: 'err' } }))
      .toThrow('Invalid status');
  });

  it('throws on non-integer status', () => {
    expect(() => defineErrors({ E: { status: 404.5 as any, code: 'ERR', message: 'err' } }))
      .toThrow('Invalid status');
  });

  it('throws on code with lowercase letters', () => {
    expect(() => defineErrors({ E: { status: 404, code: 'usr-404', message: 'err' } }))
      .toThrow('Invalid code');
  });

  it('throws on code with special characters', () => {
    expect(() => defineErrors({ E: { status: 404, code: '../admin', message: 'err' } }))
      .toThrow('Invalid code');
  });

  it('throws on code with whitespace', () => {
    expect(() => defineErrors({ E: { status: 404, code: 'USR 404', message: 'err' } }))
      .toThrow('Invalid code');
  });

  it('accepts valid code with hyphens and underscores', () => {
    expect(() => defineErrors({ E: { status: 404, code: 'USR-404_NOT_FOUND', message: 'err' } }))
      .not.toThrow();
  });
});

describe('defineErrors() — factory error safety', () => {
  it('falls back to title when message factory throws', () => {
    const errors = defineErrors({
      BAD: {
        status: 500,
        code: 'BAD-500',
        title: 'Fallback Title',
        message: () => { throw new Error('factory crash'); },
      },
    });
    try { errors.BAD(); } catch (e) {
      expect((e as RegistryError).detail).toBe('Fallback Title');
    }
  });
});

describe('defineErrors()', () => {
  it('throws RegistryError with correct status', () => {
    expect(() => UserErrors.NOT_FOUND('abc')).toThrow(RegistryError);
    try { UserErrors.NOT_FOUND('abc'); } catch (e) {
      expect((e as RegistryError).meta.status).toBe(404);
    }
  });

  it('interpolates message with provided args', () => {
    try { UserErrors.NOT_FOUND('abc-123'); } catch (e) {
      expect((e as RegistryError).detail).toBe('User with id abc-123 not found');
    }
  });

  it('uses static message when no factory', () => {
    try { UserErrors.EMAIL_TAKEN(); } catch (e) {
      expect((e as RegistryError).detail).toBe('Email already in use');
    }
  });

  it('attaches _meta with status, code, title', () => {
    expect(UserErrors.NOT_FOUND._meta.status).toBe(404);
    expect(UserErrors.NOT_FOUND._meta.code).toBe('USR-404');
    expect(UserErrors.NOT_FOUND._meta.title).toBe('User Not Found');
  });

  it('_meta is read-only', () => {
    expect(() => {
      (UserErrors.NOT_FOUND as any)._meta = {};
    }).toThrow();
  });

  it('extends HttpException so NestJS handles it natively', () => {
    const { HttpException } = require('@nestjs/common');
    try { UserErrors.NOT_FOUND('x'); } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
    }
  });

  it('sets errorKey to the catalog key', () => {
    try { UserErrors.NOT_FOUND('x'); } catch (e) {
      expect((e as RegistryError).errorKey).toBe('NOT_FOUND');
    }
  });

  it('works with zero-arg factory (static message)', () => {
    try { UserErrors.EMAIL_TAKEN(); } catch (e) {
      expect((e as RegistryError).meta.code).toBe('USR-409');
    }
  });
});
