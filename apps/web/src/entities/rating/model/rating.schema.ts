import { z } from "zod";

export const ratingSchema = z.object({
    id: z.uuid(),
    productId: z.uuid().nullable(),
    productName: z.string(),
    score: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export const ratingListSchema = z.array(ratingSchema);
export type Rating = z.infer<typeof ratingSchema>;
export type RatingList = z.infer<typeof ratingListSchema>;
