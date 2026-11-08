import {
  createRatingSchema,
  ratingQuerySchema,
  updateRatingSchema,
} from './rating.schema';

const productId = '00000000-0000-4000-8000-000000000001';

describe('Rating request schemas', () => {
  it.each([0, 6, 1.5, '5', null])('rejects invalid score %p', (score) => {
    expect(createRatingSchema.safeParse({ productId, score }).success).toBe(
      false,
    );
  });

  it.each([1, 5])(
    'accepts bounded score %p and a nullable comment',
    (score) => {
      expect(
        createRatingSchema.parse({ productId, score, comment: null }),
      ).toEqual({ productId, score, comment: null });
    },
  );

  it('bounds comments before persistence', () => {
    expect(
      createRatingSchema.safeParse({
        productId,
        score: 4,
        comment: 'x'.repeat(2000),
      }).success,
    ).toBe(true);
    expect(
      createRatingSchema.safeParse({
        productId,
        score: 4,
        comment: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('requires a nonempty partial update and forbids snapshot or ownership changes', () => {
    expect(updateRatingSchema.parse({ comment: null })).toEqual({
      comment: null,
    });
    expect(updateRatingSchema.parse({ score: 3 })).toEqual({ score: 3 });
    for (const body of [
      {},
      { userId: 'other' },
      { productId },
      { productName: 'Changed' },
    ]) {
      expect(updateRatingSchema.safeParse(body).success).toBe(false);
    }
  });

  it('rejects unbounded pagination', () => {
    expect(ratingQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(ratingQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});
