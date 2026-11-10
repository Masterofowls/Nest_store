import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';

export const productSortValues = [
  'popular',
  'price_asc',
  'price_desc',
  'rating',
  'newest',
] as const;
export type ProductSort = (typeof productSortValues)[number];

export const productBadgeValues = ['bestseller', 'low_price'] as const;

const priceFilter = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
    'Price filter must be a decimal from 0 to 99999999.99',
  );

const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const productQuerySchema = z
  .strictObject({
    ...paginationFields,
    categoryId: z.uuid().optional(),
    sellerId: z.uuid().optional(),
    sort: z.enum(productSortValues).optional(),
    minPrice: priceFilter.optional(),
    maxPrice: priceFilter.optional(),
    discounted: booleanFlag.optional(),
    inStock: booleanFlag.optional(),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      Number(query.minPrice) <= Number(query.maxPrice),
    { message: 'minPrice must not exceed maxPrice', path: ['minPrice'] },
  );
export type ProductQuery = z.infer<typeof productQuerySchema>;

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
  deliveryDays: z.number().int().min(0).max(60).optional(),
  badge: z.enum(productBadgeValues).nullable().optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one product field to update' },
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
