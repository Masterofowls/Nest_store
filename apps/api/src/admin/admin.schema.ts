import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';
import { createProductSchema } from '../products/product.schema';

export const userIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, 'Invalid user ID');

export const adminUserQuerySchema = z.strictObject({
  ...paginationFields,
  role: z.enum(['admin', 'customer']).optional(),
});
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

export const createAdminUserSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
  isAdmin: z.boolean().optional(),
});
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const updateAdminUserSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    isAdmin: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one user field to update' },
  );
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const adminOrderQuerySchema = z.strictObject({
  page: paginationFields.page,
  limit: paginationFields.limit,
  status: z.enum(['pending', 'cancelled']).optional(),
  userId: userIdSchema.optional(),
});
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

export const adminCreateProductSchema = createProductSchema.extend({
  sellerId: z.uuid(),
});
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;

export const MAX_IMPORT_CHARACTERS = 90_000;
export const importCsvSchema = z.strictObject({
  csv: z.string().min(1).max(MAX_IMPORT_CHARACTERS),
});
export type ImportCsvInput = z.infer<typeof importCsvSchema>;

const bulkIds = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Product IDs must be unique',
  );
export const bulkDeleteProductsSchema = z.strictObject({ ids: bulkIds });
export const bulkDiscountProductsSchema = bulkDeleteProductsSchema.extend({
  discountPercent: z.number().int().min(0).max(100),
});
export type BulkDeleteProductsInput = z.infer<typeof bulkDeleteProductsSchema>;
export type BulkDiscountProductsInput = z.infer<
  typeof bulkDiscountProductsSchema
>;

export const exportResourceSchema = z.enum([
  'products',
  'categories',
  'users',
  'orders',
  'banners',
]);
export type ExportResource = z.infer<typeof exportResourceSchema>;

export const exportQuerySchema = z.strictObject({
  format: z.enum(['json', 'csv']).default('json'),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
