import 'reflect-metadata';
import { Controller, Get, INestApplication, Module, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { defineErrors } from './define-errors';
import { ErrorRegistryModule } from './error-registry.module';
import { ErrorRegistryFilter } from './error-registry.filter';
import { Throws } from './throws.decorator';

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

@Controller('users')
class UsersController {
  @Get(':id')
  @Throws(UserErrors.NOT_FOUND)
  getUser(@Param('id') id: string) {
    throw UserErrors.NOT_FOUND(id);
  }

  @Get()
  list() {
    throw UserErrors.EMAIL_TAKEN();
  }
}

@Module({
  imports: [ErrorRegistryModule.forRoot({ baseUrl: 'https://api.example.com' })],
  controllers: [UsersController],
})
class TestAppModule {}

describe('ErrorRegistryFilter (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns RFC 7807 body for RegistryError', async () => {
    const res = await request(app.getHttpServer()).get('/users/abc-123');
    expect(res.status).toBe(404);
    expect(res.body.type).toBe('https://api.example.com/errors/USR-404');
    expect(res.body.title).toBe('User Not Found');
    expect(res.body.status).toBe(404);
    expect(res.body.detail).toBe('User with id abc-123 not found');
    expect(res.body.instance).toBe('/users/abc-123');
    expect(res.body.code).toBe('USR-404');
    expect(res.body.timestamp).toBeDefined();
  });

  it('sets Content-Type to application/problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/users/x');
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('handles static message errors correctly', async () => {
    const res = await request(app.getHttpServer()).get('/users');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USR-409');
    expect(res.body.detail).toBe('Email already in use');
  });

  it('instance field contains no control characters', async () => {
    const res = await request(app.getHttpServer()).get('/users/abc');
    expect(/[\x00-\x1F\x7F]/.test(res.body.instance ?? '')).toBe(false);
    expect(res.body.instance).toBe('/users/abc');
  });
});

describe('ErrorRegistryFilter (unit)', () => {
  it('builds relative type URI when no baseUrl', () => {
    const filter = new ErrorRegistryFilter({});
    const uri = (filter as any).buildTypeUri('USR-404');
    expect(uri).toBe('/errors/USR-404');
  });

  it('builds absolute type URI with baseUrl', () => {
    const filter = new ErrorRegistryFilter({ baseUrl: 'https://api.example.com' });
    const uri = (filter as any).buildTypeUri('USR-404');
    expect(uri).toBe('https://api.example.com/errors/USR-404');
  });

  it('strips trailing slash from baseUrl', () => {
    const filter = new ErrorRegistryFilter({ baseUrl: 'https://api.example.com/' });
    const uri = (filter as any).buildTypeUri('USR-404');
    expect(uri).toBe('https://api.example.com/errors/USR-404');
  });
});
