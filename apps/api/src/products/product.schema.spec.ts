import {
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
} from './product.schema';

it('should return valid product', () => {
  const input = {
    name: ' Mechanical Keyboard ',
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
    stockQuantity: 10,
    price: '129.99',
  };
  const result = createProductSchema.safeParse(input);

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.data).toEqual({
      ...input,
      name: 'Mechanical Keyboard',
    });
  }
});

describe('createProductSchema boundaries', () => {
  const input = {
    name: 'Mechanical Keyboard',
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
    stockQuantity: 10,
    price: '129.99',
  };

  it.each([
    { name: '' },
    { name: '   ' },
    { name: 'a'.repeat(201) },
    { categoryId: 'p1' },
    { stockQuantity: -1 },
    { stockQuantity: 1.5 },
    { stockQuantity: 2_147_483_648 },
    { stockQuantity: '10' },
    { price: 129.99 },
    { price: '-1.00' },
    { price: '100000000.00' },
    { price: '1.001' },
    { price: '1e2' },
    { price: '01.00' },
    { description: 'a'.repeat(5_001) },
    { discountPercent: -1 },
    { discountPercent: 101 },
    { discountPercent: 0.5 },
    { sellerId: 'another-seller' },
    { id: 'client-generated-id' },
    { name: undefined },
    { categoryId: undefined },
    { stockQuantity: undefined },
    { price: undefined },
  ])('rejects invalid creation input %#', (fields) => {
    expect(createProductSchema.safeParse({ ...input, ...fields }).success).toBe(
      false,
    );
  });

  it.each([
    { name: 'a'.repeat(200) },
    { stockQuantity: 0 },
    { stockQuantity: 2_147_483_647 },
    { price: '0' },
    { price: '0.01' },
    { price: '12.5' },
    { price: '99999999.99' },
    { description: null },
    { description: 'a'.repeat(5_000) },
    { discountPercent: 0 },
    { discountPercent: 100 },
  ])('accepts valid creation boundary %#', (fields) => {
    expect(createProductSchema.safeParse({ ...input, ...fields }).success).toBe(
      true,
    );
  });

  it('trims the description', () => {
    const result = createProductSchema.safeParse({
      ...input,
      description: ' Compact layout ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Compact layout');
    }
  });
});

describe('updateProductSchema', () => {
  it.each([
    [{ name: ' Mouse ' }, { name: 'Mouse' }],
    [{ description: null }, { description: null }],
    [{ stockQuantity: 0 }, { stockQuantity: 0 }],
    [{ discountPercent: 0 }, { discountPercent: 0 }],
    [{ price: '0.00' }, { price: '0.00' }],
  ])(
    'accepts partial updates without adding omitted fields %#',
    (input, output) => {
      const result = updateProductSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(output);
      }
    },
  );

  it.each([
    {},
    { name: undefined },
    { name: '   ' },
    { categoryId: 'invalid' },
    { stockQuantity: -1 },
    { price: '1.001' },
    { discountPercent: 101 },
    { description: 'a'.repeat(5_001) },
    { name: null },
    { sellerId: 'another-seller' },
    { name: 'Mouse', id: 'client-generated-id' },
  ])('rejects empty or invalid updates %#', (input) => {
    expect(updateProductSchema.safeParse(input).success).toBe(false);
  });
});

describe('productQuerySchema catalog options', () => {
  it('parses sort, price range and boolean flags from query strings', () => {
    expect(
      productQuerySchema.parse({
        sort: 'price_desc',
        minPrice: '10',
        maxPrice: '99.5',
        discounted: 'true',
        inStock: 'false',
      }),
    ).toEqual({
      page: 1,
      limit: 10,
      sort: 'price_desc',
      minPrice: '10',
      maxPrice: '99.5',
      discounted: true,
      inStock: false,
    });
  });

  it.each([
    { sort: 'cheapest' },
    { discounted: '1' },
    { inStock: 'yes' },
    { minPrice: '-1' },
    { maxPrice: '1.999' },
    { minPrice: '50', maxPrice: '10' },
  ])('rejects %o', (query) => {
    expect(productQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each([{ deliveryDays: -1 }, { deliveryDays: 61 }, { badge: 'sale' }])(
    'rejects product field %o',
    (field) => {
      expect(
        createProductSchema.safeParse({
          name: 'Keyboard',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          stockQuantity: 1,
          price: '10',
          ...field,
        }).success,
      ).toBe(false);
    },
  );
});
