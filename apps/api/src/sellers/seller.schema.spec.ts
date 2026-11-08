import { createSellerSchema, updateSellerSchema } from './seller.schema';

describe('Seller profile validation', () => {
  it('trims the name and description', () => {
    expect(
      createSellerSchema.parse({
        storeName: ' Store ',
        description: ' About ',
      }),
    ).toEqual({ storeName: 'Store', description: 'About' });
  });

  it.each([
    {},
    { storeName: '' },
    { storeName: ' ' },
    { storeName: 1 },
    { storeName: 'a'.repeat(201) },
    { storeName: 'Store', description: 'a'.repeat(5001) },
    { storeName: 'Store', userId: 'other' },
    { storeName: 'Store', id: 'other' },
    { storeName: 'Store', role: 'admin' },
  ])('rejects invalid create input %j', (input) => {
    expect(createSellerSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    {},
    { storeName: undefined },
    { storeName: '' },
    { userId: 'other' },
  ])('rejects invalid updates %j', (input) => {
    expect(updateSellerSchema.safeParse(input).success).toBe(false);
  });

  it('allows clearing the description without changing the name', () => {
    expect(updateSellerSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });
});
