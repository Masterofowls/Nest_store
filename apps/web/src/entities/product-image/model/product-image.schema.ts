import { z } from "zod";

export const productImageSchema = z.object({
    id: z.uuid(),
    productId: z.uuid(),
    url: z.string(),
    createdAt: z.iso.datetime(),
});
export const productImageListSchema = z.array(productImageSchema);
export type ProductImage = z.infer<typeof productImageSchema>;
export type ProductImageList = z.infer<typeof productImageListSchema>;
