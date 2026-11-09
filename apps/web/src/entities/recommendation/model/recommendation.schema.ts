import { z } from "zod";
import { productSchema } from "../../product/model/product.schema";

export const recommendationSchema = productSchema.extend({
    coViewers: z.number().int().positive(),
});
export const recommendationListSchema = z.array(recommendationSchema);
export type Recommendation = z.infer<typeof recommendationSchema>;
export type RecommendationList = z.infer<typeof recommendationListSchema>;
