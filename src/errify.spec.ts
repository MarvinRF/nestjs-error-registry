import 'reflect-metadata';
import { errify } from './errify';
import { ErrifyError } from './errify-error';

const UserErrors = errify({
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

describe('errify()', () => {
  it('throws ErrifyError with correct status', () => {
    expect(() => UserErrors.NOT_FOUND('abc')).toThrow(ErrifyError);
    try { UserErrors.NOT_FOUND('abc'); } catch (e) {
      expect((e as ErrifyError).meta.status).toBe(404);
    }
  });

  it('interpolates message with provided args', () => {
    try { UserErrors.NOT_FOUND('abc-123'); } catch (e) {
      expect((e as ErrifyError).detail).toBe('User with id abc-123 not found');
    }
  });

  it('uses static message when no factory', () => {
    try { UserErrors.EMAIL_TAKEN(); } catch (e) {
      expect((e as ErrifyError).detail).toBe('Email already in use');
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
      expect((e as ErrifyError).errorKey).toBe('NOT_FOUND');
    }
  });

  it('works with zero-arg factory (static message)', () => {
    try { UserErrors.EMAIL_TAKEN(); } catch (e) {
      expect((e as ErrifyError).meta.code).toBe('USR-409');
    }
  });
});
