import { z } from "zod";

export const productSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    sellerId: z.string().uuid(),
    categoryId: z.string().uuid(),
    stockQuantity: z.number().int().min(0).max(2_147_483_647),
    discountPercent: z.number().int().min(0).max(100),
    price: z.string().regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/),
});

export type Product = z.infer<typeof productSchema>;
export const productListSchema = z.array(productSchema);
export type ProductList = z.infer<typeof productListSchema>;
