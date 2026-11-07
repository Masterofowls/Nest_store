import { z } from 'zod';

export const createProductSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  categoryId: z.uuid(),
  stockQuantity: z.number().int().min(0).max(2_147_483_647),
  price: z
    .string()
    .regex(
      /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
      'Price must be a decimal string from 0 to 99999999.99 with at most two decimal places',
    ),
  description: z.string().trim().max(5_000).nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one product field to update' },
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
