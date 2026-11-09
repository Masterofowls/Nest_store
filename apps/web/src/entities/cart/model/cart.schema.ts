import { z } from "zod";
import { productSchema } from "../../product/model/product.schema";

export const cartItemSchema = z.object({
    id: z.uuid(),
    productId: z.uuid(),
    quantity: z.number().int().positive().max(2_147_483_647),
    product: productSchema,
});
export const cartMutationItemSchema = z.object({
    id: z.uuid(),
    cartId: z.uuid(),
    productId: z.uuid(),
    quantity: z.number().int().positive().max(2_147_483_647),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export const cartSchema = z.object({
    id: z.uuid().nullable(),
    items: z.array(cartItemSchema),
});
export type CartItem = z.infer<typeof cartItemSchema>;
export type CartMutationItem = z.infer<typeof cartMutationItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
