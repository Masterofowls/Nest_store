import { recommendationQuerySchema } from './recommendation.schema';

describe('Recommendation request schema', () => {
  it('uses bounded shared pagination defaults', () => {
    expect(recommendationQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(recommendationQuerySchema.parse({ limit: '100' })).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it.each([
    { limit: '101' },
    { page: '0' },
    { userId: 'other' },
    { sort: 'random' },
    { search: 'Keyboard' },
  ])('rejects unsupported recommendation query %p', (query) => {
    expect(recommendationQuerySchema.safeParse(query).success).toBe(false);
  });
});
