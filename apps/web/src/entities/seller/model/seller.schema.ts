import { z } from "zod";

export const sellerSchema = z.object({
    id: z.uuid(),
    storeName: z.string(),
    description: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export const sellerListSchema = z.array(sellerSchema);
export type Seller = z.infer<typeof sellerSchema>;
export type SellerList = z.infer<typeof sellerListSchema>;
