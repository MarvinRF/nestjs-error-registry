import 'reflect-metadata';
import { Throws, THROWS_METADATA_KEY } from './throws.decorator';
import { defineErrors } from './define-errors';

const OrderErrors = defineErrors({
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
    message: 'Payment processing failed',
  },
  DUPLICATE: {
    status: 409,
    code: 'ORD-409',
    title: 'Duplicate Order',
    message: (ref: string) => `Order ${ref} already exists`,
  },
});

function freshHandler() {
  const obj = {
    handler() { return 'ok'; },
  };
  return obj;
}

describe('@Throws()', () => {
  it('sets THROWS_METADATA_KEY with array of ErrorMeta', () => {
    const controller = freshHandler();
    const descriptor = Object.getOwnPropertyDescriptor(controller, 'handler')!;
    Throws(OrderErrors.NOT_FOUND)(controller, 'handler', descriptor);

    const metas = Reflect.getMetadata(THROWS_METADATA_KEY, descriptor.value);
    expect(metas).toHaveLength(1);
    expect(metas[0].code).toBe('ORD-404');
    expect(metas[0].status).toBe(404);
  });

  it('stores all declared errors in metadata', () => {
    const controller = freshHandler();
    const descriptor = Object.getOwnPropertyDescriptor(controller, 'handler')!;
    Throws(OrderErrors.NOT_FOUND, OrderErrors.PAYMENT_FAILED)(controller, 'handler', descriptor);

    const metas = Reflect.getMetadata(THROWS_METADATA_KEY, descriptor.value);
    expect(metas).toHaveLength(2);
    expect(metas.map((m: any) => m.code)).toEqual(['ORD-404', 'ORD-402']);
  });

  it('works with multiple errors of different statuses', () => {
    const controller = freshHandler();
    const descriptor = Object.getOwnPropertyDescriptor(controller, 'handler')!;
    Throws(OrderErrors.NOT_FOUND, OrderErrors.PAYMENT_FAILED, OrderErrors.DUPLICATE)(
      controller, 'handler', descriptor,
    );

    const metas = Reflect.getMetadata(THROWS_METADATA_KEY, descriptor.value);
    const statuses = metas.map((m: any) => m.status);
    expect(statuses).toContain(404);
    expect(statuses).toContain(402);
    expect(statuses).toContain(409);
  });

  it('can be applied to multiple handlers independently', () => {
    const c1 = freshHandler();
    const c2 = freshHandler();
    const d1 = Object.getOwnPropertyDescriptor(c1, 'handler')!;
    const d2 = Object.getOwnPropertyDescriptor(c2, 'handler')!;

    Throws(OrderErrors.NOT_FOUND)(c1, 'handler', d1);
    Throws(OrderErrors.PAYMENT_FAILED)(c2, 'handler', d2);

    expect(Reflect.getMetadata(THROWS_METADATA_KEY, d1.value)[0].code).toBe('ORD-404');
    expect(Reflect.getMetadata(THROWS_METADATA_KEY, d2.value)[0].code).toBe('ORD-402');
  });
});
