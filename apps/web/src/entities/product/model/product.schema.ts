import { z } from "zod";

export const productSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    sellerId: z.string().uuid(),
    categoryId: z.string().uuid(),
    stockQuantity: z.number().int().min(0).max(2_147_483_647),
    discountPercent: z.number().int().min(0).max(100),
    price: z.string().regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/),
    deliveryDays: z.number().int().min(0).max(60).optional(),
    badge: z.enum(["bestseller", "low_price"]).nullable().optional(),
    createdAt: z.iso.datetime().optional(),
    // Only list and detail reads include rating stats.
    averageRating: z.number().min(1).max(5).nullable().optional(),
    ratingCount: z.number().int().min(0).optional(),
    slug: z.string().optional(),
    brand: z.object({ id: z.uuid(), name: z.string() }).nullable().optional(),
    // Present (possibly null) on list and detail reads, so a tile can skip
    // its own image request.
    imageUrl: z.string().nullable().optional(),
});

const attributeTypeSchema = z.enum(["text", "number", "boolean"]);
export type AttributeType = z.infer<typeof attributeTypeSchema>;

export const productAttributeSchema = z.object({
    slug: z.string(),
    name: z.string(),
    type: attributeTypeSchema,
    unit: z.string().nullable(),
    value: z.string(),
});
export type ProductAttribute = z.infer<typeof productAttributeSchema>;

export const productVariantSchema = z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    stockQuantity: z.number().int().min(0),
    imageUrl: z.string().nullable(),
    color: z.string().nullable(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productDetailSchema = productSchema.extend({
    attributes: z.array(productAttributeSchema),
    variants: z.array(productVariantSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;
export const productDetailListSchema = z.array(productDetailSchema);

export const productFacetsSchema = z.object({
    brands: z.array(
        z.object({
            id: z.uuid(),
            name: z.string(),
            count: z.number().int().min(0),
        }),
    ),
    attributes: z.array(
        z.object({
            slug: z.string(),
            name: z.string(),
            type: attributeTypeSchema,
            unit: z.string().nullable(),
            options: z.array(
                z.object({
                    value: z.string(),
                    count: z.number().int().min(0),
                }),
            ),
        }),
    ),
    price: z.object({
        min: z.string().nullable(),
        max: z.string().nullable(),
    }),
});
export type ProductFacets = z.infer<typeof productFacetsSchema>;

export function productHref(product: { id: string; slug?: string }) {
    return `/products/${product.slug ?? product.id}`;
}

export const productSortValues = [
    "popular",
    "price_asc",
    "price_desc",
    "rating",
    "newest",
] as const;
export type ProductSort = (typeof productSortValues)[number];

export type Product = z.infer<typeof productSchema>;
export const productListSchema = z.array(productSchema);
export type ProductList = z.infer<typeof productListSchema>;
