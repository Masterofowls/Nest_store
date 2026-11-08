import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';

export const recommendationQuerySchema = z.strictObject({
  page: paginationFields.page,
  limit: paginationFields.limit,
});
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
