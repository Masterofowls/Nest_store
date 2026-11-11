import { z } from 'zod';
import { paginationFields } from '../common/pagination.schema';
import { attributeSlugPattern } from '../attributes/attribute.schema';

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

export const MAX_BRAND_FILTERS = 20;
export const MAX_ATTRIBUTE_FILTERS = 10;
export const MAX_ATTRIBUTE_FILTER_VALUES = 20;
export const MAX_COMPARED_PRODUCTS = 4;

const uuidList = (max: number) =>
  z
    .string()
    .max(max * 37)
    .transform((value) => value.split(','))
    .pipe(z.array(z.uuid()).min(1).max(max));

export type AttributeFilter = { slug: string; values: string[] };

// "color:black|white;anc:true": values of one attribute are alternatives,
// different attributes must all match.
function parseAttributeFilters(input: string): AttributeFilter[] | null {
  const filters: AttributeFilter[] = [];
  for (const part of input.split(';')) {
    const separator = part.indexOf(':');
    if (separator <= 0) return null;
    const slug = part.slice(0, separator);
    const values = part.slice(separator + 1).split('|');
    if (
      !attributeSlugPattern.test(slug) ||
      filters.some((filter) => filter.slug === slug) ||
      values.length > MAX_ATTRIBUTE_FILTER_VALUES ||
      values.some((value) => value.length === 0 || value.length > 100)
    ) {
      return null;
    }
    filters.push({ slug, values });
  }
  return filters.length > MAX_ATTRIBUTE_FILTERS ? null : filters;
}

const attributeFilters = z
  .string()
  .max(2_000)
  .transform(parseAttributeFilters)
  .refine((filters) => filters !== null, {
    message: 'attrs must look like "slug:value|value;slug:value"',
  })
  .transform((filters) => filters ?? []);

export const productQuerySchema = z
  .strictObject({
    ...paginationFields,
    categoryId: z.uuid().optional(),
    sellerId: z.uuid().optional(),
    brandIds: uuidList(MAX_BRAND_FILTERS).optional(),
    attrs: attributeFilters.optional(),
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

export const compareQuerySchema = z.strictObject({
  ids: uuidList(MAX_COMPARED_PRODUCTS),
});
export type CompareQuery = z.infer<typeof compareQuerySchema>;

export const productSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const productReferenceSchema = z
  .string()
  .max(300)
  .refine(
    (value) => uuidPattern.test(value) || productSlugPattern.test(value),
    'Product reference must be an id or a slug',
  );
export function isProductId(reference: string): boolean {
  return uuidPattern.test(reference);
}

const attributeValueInput = z.strictObject({
  attributeId: z.uuid(),
  value: z.union([
    z.string().trim().min(1).max(200),
    z.number().min(-999_999_999).max(999_999_999),
    z.boolean(),
  ]),
});
export type AttributeValueInput = z.infer<typeof attributeValueInput>;

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
  brandId: z.uuid().nullable().optional(),
  // Links this product to another of the seller's products as a variant of
  // the same item; null removes it from its group.
  variantOfProductId: z.uuid().nullable().optional(),
  attributes: z
    .array(attributeValueInput)
    .max(50)
    .refine(
      (values) =>
        new Set(values.map((value) => value.attributeId)).size ===
        values.length,
      'Each attribute may be set once',
    )
    .optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one product field to update' },
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
