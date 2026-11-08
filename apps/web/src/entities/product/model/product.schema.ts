import z from "zod";

export const productSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable()
})