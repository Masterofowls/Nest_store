import { z } from 'zod';

export const attributeTypeValues = ['text', 'number', 'boolean'] as const;
export type AttributeType = (typeof attributeTypeValues)[number];

export const attributeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createAttributeSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(60).regex(attributeSlugPattern),
  type: z.enum(attributeTypeValues),
  unit: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value)),
  categoryId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

// Slug and type stay fixed: stored values and saved filter links depend on them.
export const updateAttributeSchema = createAttributeSchema
  .omit({ slug: true, type: true })
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one attribute field to update' },
  );

export const attributeQuerySchema = z.strictObject({
  categoryId: z.uuid().optional(),
});

export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>;
export type AttributeQuery = z.infer<typeof attributeQuerySchema>;
