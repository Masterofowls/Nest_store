import {
  addCartItemSchema,
  cartQuerySchema,
  updateCartItemSchema,
} from './cart.schema';

const productId = '00000000-0000-4000-8000-000000000001';

describe('Cart input', () => {
  it.each([1, 999])('accepts quantity %s', (quantity) => {
    expect(addCartItemSchema.parse({ productId, quantity })).toEqual({
      productId,
      quantity,
    });
    expect(updateCartItemSchema.parse({ quantity })).toEqual({ quantity });
  });

  it.each([0, -1, 1.5, 1000, '2', null, undefined, Infinity])(
    'rejects quantity %s',
    (quantity) => {
      expect(addCartItemSchema.safeParse({ productId, quantity }).success).toBe(
        false,
      );
      expect(updateCartItemSchema.safeParse({ quantity }).success).toBe(false);
    },
  );

  it('rejects invalid IDs and server-owned fields', () => {
    expect(
      addCartItemSchema.safeParse({ productId: 'no', quantity: 1 }).success,
    ).toBe(false);
    expect(
      addCartItemSchema.safeParse({ productId, quantity: 1, userId: 'other' })
        .success,
    ).toBe(false);
  });

  it('validates and defaults cart pagination', () => {
    expect(cartQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(cartQuerySchema.parse({ page: '2', limit: '100' })).toEqual({
      page: 2,
      limit: 100,
    });
    expect(cartQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(cartQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(cartQuerySchema.safeParse({ userId: 'other' }).success).toBe(false);
  });
});
