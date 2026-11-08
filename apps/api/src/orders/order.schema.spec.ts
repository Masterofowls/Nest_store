import {
  cancelOrderSchema,
  checkoutBodySchema,
  checkoutKeySchema,
  orderQuerySchema,
} from './order.schema';

describe('Order input', () => {
  it('requires and normalizes a UUID checkout key', () => {
    expect(
      checkoutKeySchema.parse('ABCDEF00-0000-4000-8000-000000000001'),
    ).toBe('abcdef00-0000-4000-8000-000000000001');
    expect(checkoutKeySchema.safeParse(undefined).success).toBe(false);
    expect(checkoutKeySchema.safeParse('retry').success).toBe(false);
  });

  it('accepts only an empty checkout body', () => {
    expect(checkoutBodySchema.parse(undefined)).toEqual({});
    expect(checkoutBodySchema.parse({})).toEqual({});
    expect(checkoutBodySchema.safeParse({ totalAmount: '0.00' }).success).toBe(
      false,
    );
  });

  it('permits cancellation but no payment or other status changes', () => {
    expect(cancelOrderSchema.parse({ status: 'cancelled' })).toEqual({
      status: 'cancelled',
    });
    expect(cancelOrderSchema.safeParse({ status: 'paid' }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ status: 'pending' }).success).toBe(
      false,
    );
    expect(
      cancelOrderSchema.safeParse({ status: 'cancelled', userId: 'other' })
        .success,
    ).toBe(false);
  });

  it('bounds pagination and limits status filters', () => {
    expect(orderQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(
      orderQuerySchema.parse({ page: '2', limit: '100', status: 'pending' }),
    ).toEqual({ page: 2, limit: 100, status: 'pending' });
    expect(orderQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(orderQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(orderQuerySchema.safeParse({ status: 'paid' }).success).toBe(false);
    expect(orderQuerySchema.safeParse({ userId: 'other' }).success).toBe(false);
  });
});
