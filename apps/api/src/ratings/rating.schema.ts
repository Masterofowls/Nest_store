import { z } from 'zod';
import { paginationSchema } from '../common/pagination.schema';

const ratingFields = {
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullable().optional(),
};
export const createRatingSchema = z.strictObject({
  productId: z.uuid(),
  ...ratingFields,
});
export const updateRatingSchema = z
  .strictObject(ratingFields)
  .partial()
  .refine((input) => input.score !== undefined || input.comment !== undefined, {
    message: 'At least one rating field is required',
  });
export const ratingQuerySchema = paginationSchema;
export const emptyRatingBodySchema = z.strictObject({}).optional();
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;
export type RatingQuery = z.infer<typeof ratingQuerySchema>;
