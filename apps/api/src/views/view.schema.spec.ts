import { createViewSchema, viewQuerySchema } from './view.schema';

describe('View request schemas', () => {
  it('takes no user-supplied interaction identity or timestamp', () => {
    expect(createViewSchema.parse({})).toEqual({});
    expect(createViewSchema.parse(undefined)).toBeUndefined();
    expect(createViewSchema.safeParse({ userId: 'other' }).success).toBe(false);
    expect(createViewSchema.safeParse({ viewedAt: '2026-01-01' }).success).toBe(
      false,
    );
  });

  it('bounds history pagination', () => {
    expect(viewQuerySchema.parse({ page: '2', limit: '1' })).toEqual({
      page: 2,
      limit: 1,
    });
    expect(viewQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(viewQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});
