import { z } from "zod";

export const favouriteSchema = z.object({
    id: z.uuid(),
    productId: z.uuid().nullable(),
    productName: z.string(),
    createdAt: z.iso.datetime(),
});
export const favouriteListSchema = z.array(favouriteSchema);
export type Favourite = z.infer<typeof favouriteSchema>;
export type FavouriteList = z.infer<typeof favouriteListSchema>;
