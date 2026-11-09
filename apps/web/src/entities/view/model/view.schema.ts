import { z } from "zod";

export const viewSchema = z.object({
    id: z.uuid(),
    productId: z.uuid(),
    viewedAt: z.iso.datetime(),
});
export const viewHistoryItemSchema = viewSchema.extend({
    productName: z.string(),
});
export const viewHistorySchema = z.array(viewHistoryItemSchema);
export type ProductView = z.infer<typeof viewSchema>;
export type ViewHistoryItem = z.infer<typeof viewHistoryItemSchema>;
export type ViewHistory = z.infer<typeof viewHistorySchema>;
