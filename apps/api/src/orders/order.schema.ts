import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';

export const checkoutKeySchema = z
  .uuid()
  .transform((value) => value.toLowerCase());
export const checkoutBodySchema = z.strictObject({}).default({});
export const cancelOrderSchema = z.strictObject({
  status: z.literal('cancelled'),
});
export const orderQuerySchema = z.strictObject({
  page: paginationFields.page,
  limit: paginationFields.limit,
  status: z.enum(['pending', 'cancelled']).optional(),
});
export type OrderQuery = z.infer<typeof orderQuerySchema>;
