import {
  createFavouriteSchema,
  emptyFavouriteBodySchema,
  favouriteQuerySchema,
} from './favourite.schema';

const productId = '00000000-0000-4000-8000-000000000001';

describe('Favourite request schemas', () => {
  it('accepts only a UUID product identifier', () => {
    expect(createFavouriteSchema.parse({ productId })).toEqual({ productId });
    expect(
      createFavouriteSchema.safeParse({ productId: 'missing' }).success,
    ).toBe(false);
    expect(
      createFavouriteSchema.safeParse({ productId, userId: 'other' }).success,
    ).toBe(false);
  });

  it('bounds pagination and rejects ownership query fields', () => {
    expect(
      favouriteQuerySchema.parse({
        page: '2',
        limit: '3',
        search: ' Keyboard ',
      }),
    ).toEqual({
      page: 2,
      limit: 3,
      search: 'Keyboard',
    });
    expect(favouriteQuerySchema.safeParse({ limit: '101' }).success).toBe(
      false,
    );
    expect(favouriteQuerySchema.safeParse({ userId: 'other' }).success).toBe(
      false,
    );
  });

  it('rejects payloads on deletion', () => {
    expect(emptyFavouriteBodySchema.parse(undefined)).toBeUndefined();
    expect(emptyFavouriteBodySchema.safeParse({ productId }).success).toBe(
      false,
    );
  });
});
