import { z } from "zod";
import { productSchema } from "../../product/model/product.schema";

export const orderItemSchema = z.object({
    id: z.uuid(),
    orderId: z.uuid(),
    productId: z.uuid().nullable(),
    productName: z.string(),
    quantity: z.number().int().positive().max(2_147_483_647),
    unitPrice: productSchema.shape.price,
});
export const orderSchema = z.object({
    id: z.uuid(),
    userId: z.string().nullable(),
    status: z.string(),
    checkoutKey: z.string().nullable(),
    totalAmount: productSchema.shape.price,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export const orderListSchema = z.array(orderSchema);
export const orderDetailSchema = orderSchema.extend({
    items: z.array(orderItemSchema),
});
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderList = z.infer<typeof orderListSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
