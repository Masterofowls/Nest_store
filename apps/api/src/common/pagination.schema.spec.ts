import { paginationSchema } from './pagination.schema';
import { productQuerySchema } from '../products/product.schema';

describe('List query validation', () => {
  it('defaults pagination', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('accepts the limit boundary and trims search', () => {
    expect(
      paginationSchema.parse({ search: ' keyboard ', page: '2', limit: '100' }),
    ).toEqual({ search: 'keyboard', page: 2, limit: 100 });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { page: '2147483648' },
    { page: '99999999999999999999999' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'abc' },
    { search: ['a', 'b'] },
    { search: 'a'.repeat(201) },
    { unexpected: true },
  ])('rejects invalid query %j', (input) => {
    expect(paginationSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { categoryId: 'bad' },
    { sellerId: 'bad' },
    { sellerId: ['a', 'b'] },
  ])('rejects invalid product filters %j', (input) => {
    expect(productQuerySchema.safeParse(input).success).toBe(false);
  });
});
