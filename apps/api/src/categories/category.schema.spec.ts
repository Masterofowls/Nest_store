import { categorySchema } from './category.schema';

describe('Category validation', () => {
  it('trims a valid category name', () => {
    expect(categorySchema.parse({ name: ' Keyboards ' })).toEqual({
      name: 'Keyboards',
    });
  });

  it('accepts the maximum name length', () => {
    expect(categorySchema.safeParse({ name: 'a'.repeat(200) }).success).toBe(
      true,
    );
  });

  it.each([
    {},
    { name: '' },
    { name: ' ' },
    { name: 42 },
    { name: null },
    { name: 'a'.repeat(201) },
    { name: 'Keyboards', id: 'client-id' },
    { name: 'Keyboards', isAdmin: true },
    { name: 'Keyboards', description: 'unsupported' },
  ])('rejects invalid or unexpected fields %j', (input) => {
    expect(categorySchema.safeParse(input).success).toBe(false);
  });
});
