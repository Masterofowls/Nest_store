import { z } from 'zod';

export const createSellerSchema = z.strictObject({
  storeName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).nullable().optional(),
});

export const updateSellerSchema = createSellerSchema
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one seller field to update' },
  );

export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
