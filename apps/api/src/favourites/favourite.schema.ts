import { z } from 'zod';
import { paginationSchema } from '../common/pagination.schema';

export const favouriteQuerySchema = paginationSchema;
export const createFavouriteSchema = z.strictObject({
  productId: z.uuid(),
});
export const emptyFavouriteBodySchema = z.strictObject({}).optional();
export type FavouriteQuery = z.infer<typeof favouriteQuerySchema>;
export type CreateFavouriteInput = z.infer<typeof createFavouriteSchema>;
