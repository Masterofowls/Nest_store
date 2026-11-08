import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';

export const MAX_CART_QUANTITY = 999;
export const quantitySchema = z.number().int().min(1).max(MAX_CART_QUANTITY);
export const addCartItemSchema = z.strictObject({
  productId: z.uuid(),
  quantity: quantitySchema,
});
export const updateCartItemSchema = z.strictObject({
  quantity: quantitySchema,
});
export const cartQuerySchema = z.strictObject({
  page: paginationFields.page,
  limit: paginationFields.limit,
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CartQuery = z.infer<typeof cartQuerySchema>;
