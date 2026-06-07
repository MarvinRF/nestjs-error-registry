# nestjs-error-registry

Typed error catalog for NestJS. Define all your HTTP errors once, throw them with full TypeScript inference, get RFC 7807 Problem Details responses automatically, and have Swagger `@ApiResponse` schemas generated via `@Throws()` — without touching a single `@ApiResponse` decorator.

## The problem

```ts
// Scattered across your codebase — no contract, no types, no Swagger
throw new NotFoundException(`User with id ${id} not found`);
throw new ConflictException('Email already in use');
```

No single source of truth. No TypeScript enforcement at the call site. Swagger docs require manual `@ApiResponse` maintenance. Error messages are strings with no structure.

## The solution

```ts
// errors/user.errors.ts — one place, full contract
export const UserErrors = errify({
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
```

```ts
// users.service.ts — TypeScript enforces the args
throw UserErrors.NOT_FOUND(userId);  // (id: string) ✓
throw UserErrors.EMAIL_TAKEN();      // () ✓
```

```ts
// users.controller.ts — Swagger wired automatically
@Get(':id')
@Throws(UserErrors.NOT_FOUND)
async getUser(@Param('id') id: string) {
  return this.usersService.findById(id);
}
```

```json
// HTTP response — RFC 7807 Problem Details
{
  "type": "https://api.example.com/errors/USR-404",
  "title": "User Not Found",
  "status": 404,
  "detail": "User with id abc-123 not found",
  "instance": "/users/abc-123",
  "timestamp": "2026-06-07T20:00:00.000Z",
  "code": "USR-404"
}
```

## Installation

```bash
npm install nestjs-error-registry
```

**Peer dependencies** (already in your project):

```bash
npm install @nestjs/common @nestjs/core reflect-metadata
# optional — only needed for @Throws() Swagger integration:
npm install @nestjs/swagger
```

## Setup

```ts
// app.module.ts
import { ErrifyModule } from 'nestjs-error-registry';

@Module({
  imports: [
    ErrifyModule.forRoot({
      baseUrl: 'https://api.example.com',
    }),
  ],
})
export class AppModule {}
```

## Defining errors

```ts
import { errify } from 'nestjs-error-registry';

export const OrderErrors = errify({
  NOT_FOUND: {
    status: 404,
    code: 'ORD-404',
    title: 'Order Not Found',
    message: (id: string) => `Order ${id} not found`,
  },
  PAYMENT_FAILED: {
    status: 402,
    code: 'ORD-402',
    title: 'Payment Failed',
    message: (reason: string) => `Payment failed: ${reason}`,
  },
  DUPLICATE: {
    status: 409,
    code: 'ORD-409',
    title: 'Duplicate Order',
    message: 'An order with this reference already exists',
  },
});
```

Each definition has:

| Field | Required | Description |
|---|---|---|
| `status` | ✓ | HTTP status code |
| `code` | ✓ | Machine-readable error code (used in RFC 7807 `type` URI) |
| `title` | — | Short human-readable summary. Defaults to `code` |
| `message` | ✓ | Static string or factory function — TypeScript infers parameter types |

## Throwing errors

```ts
// Factory message — TypeScript enforces (id: string)
throw OrderErrors.NOT_FOUND(orderId);

// Multi-arg factory
throw OrderErrors.PAYMENT_FAILED('insufficient funds');

// Static message — no args required
throw OrderErrors.DUPLICATE();
```

The return type is `never` — TypeScript understands that execution stops here. Works with or without the explicit `throw` keyword.

## `@Throws()` decorator

Declare which errors a route can throw. Automatically injects `@ApiResponse` into Swagger for each declared error with a full RFC 7807 schema.

```ts
@Controller('orders')
export class OrdersController {
  @Post()
  @Throws(OrderErrors.DUPLICATE, OrderErrors.PAYMENT_FAILED)
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @Throws(OrderErrors.NOT_FOUND)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }
}
```

Errors with the same HTTP status are merged into a single `@ApiResponse` with a `code` enum listing all possible error codes.

`@nestjs/swagger` is an optional peer dependency — if not installed, `@Throws()` sets the Reflect metadata but skips Swagger injection silently.

## RFC 7807 response format

Every `ErrifyError` is formatted as [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) with `Content-Type: application/problem+json`:

```json
{
  "type": "https://api.example.com/errors/ORD-404",
  "title": "Order Not Found",
  "status": 404,
  "detail": "Order ord-abc-123 not found",
  "instance": "/orders/ord-abc-123",
  "timestamp": "2026-06-07T20:00:00.000Z",
  "code": "ORD-404"
}
```

## Module options

```ts
ErrifyModule.forRoot({
  // Prefix for the RFC 7807 'type' URI. Default: '' (relative: '/errors/ORD-404')
  baseUrl: 'https://api.example.com',

  // When true (default), non-ErrifyError HttpExceptions are passed to the
  // default NestJS handler. Set to false to handle everything here.
  passthrough: true,
})
```

## Advanced: introspect declared errors at runtime

`@Throws()` stores `ErrorMeta[]` on the handler via `Reflect.defineMetadata`. Readable in guards, interceptors, or tooling:

```ts
import { THROWS_METADATA_KEY } from 'nestjs-error-registry';

const metas = Reflect.getMetadata(THROWS_METADATA_KEY, handler);
// [{ status: 404, code: 'ORD-404', title: 'Order Not Found', ... }]
```

## Using without `ErrifyModule`

If you already have a global exception filter, use `ErrifyExceptionFilter` directly:

```ts
import { ErrifyExceptionFilter } from 'nestjs-error-registry';

app.useGlobalFilters(new ErrifyExceptionFilter({ baseUrl: 'https://api.example.com' }));
```

## License

MIT
