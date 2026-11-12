import { z } from "zod";
import { baseApi } from "@/shared/api/baseApi";
import { parseResponse } from "@/shared/api/response";
import { productSchema } from "@/entities/product/model/product.schema";
import { categorySchema } from "@/entities/category/model/category.schema";
import { sellerSchema } from "@/entities/seller/model/seller.schema";
import { orderItemSchema } from "@/entities/order/model/order.schema";

const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    isAdmin: z.boolean(),
});
const userDetailSchema = userSchema.extend({
    orderCount: z.number(),
    totalSpent: z.string(),
    seller: z.object({ id: z.uuid(), storeName: z.string() }).nullable(),
    recentOrders: z.array(
        z.object({
            id: z.uuid(),
            status: z.string(),
            totalAmount: z.string(),
        }),
    ),
});
const orderSchema = z.object({
    id: z.uuid(),
    userId: z.string().nullable(),
    status: z.string(),
    totalAmount: z.string(),
    customerEmail: z.string().nullable(),
    customerName: z.string().nullable(),
    createdAt: z.string(),
});
const bannerSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    linkUrl: z.string().nullable(),
    imageUrl: z.string().nullable(),
    isActive: z.boolean(),
    sortOrder: z.number(),
});
const publicBannerSchema = bannerSchema.extend({
    linkUrl: z
        .string()
        .refine((value) => {
            if (
                value.startsWith("/") &&
                !value.startsWith("//") &&
                !value.includes("\\")
            )
                return true;
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
                (url.protocol === "http:" || url.protocol === "https:") &&
                !url.username &&
                !url.password
            );
        })
        .nullable(),
    imageUrl: z
        .string()
        .refine((value) => {
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
                (url.protocol === "http:" || url.protocol === "https:") &&
                !url.username &&
                !url.password
            );
        })
        .nullable(),
});
const statsSchema = z.object({
    users: z.number(),
    sellers: z.number(),
    products: z.number(),
    outOfStockProducts: z.number(),
    categories: z.number(),
    orders: z.number(),
    pendingOrders: z.number(),
    revenue: z.string(),
});
const importResultSchema = z.object({
    created: z.number(),
    skipped: z
        .array(z.object({ row: z.number(), message: z.string() }))
        .optional(),
});

export type ManagedProduct = z.infer<typeof productSchema>;
export type ManagedUser = z.infer<typeof userSchema>;
export type ManagedBanner = z.infer<typeof bannerSchema>;
const brandSchema = z.object({ id: z.uuid(), name: z.string() });
const attributeDefinitionSchema = z.object({
    id: z.uuid(),
    categoryId: z.uuid().nullable(),
    name: z.string(),
    slug: z.string(),
    type: z.enum(["text", "number", "boolean"]),
    unit: z.string().nullable(),
    sortOrder: z.number().int(),
});

export type Brand = z.infer<typeof brandSchema>;
export type AttributeDefinition = z.infer<typeof attributeDefinitionSchema>;
export type AttributeValueInput = {
    attributeId: string;
    value: string | number | boolean;
};
export type AttributeDefinitionInput = {
    name: string;
    slug: string;
    type: AttributeDefinition["type"];
    unit: string | null;
    categoryId: string | null;
};
export type ProductInput = {
    name: string;
    categoryId: string;
    price: string;
    stockQuantity: number;
    discountPercent: number;
    description: string | null;
    brandId?: string | null;
    variantOfProductId?: string;
    // Omitted when the attribute list could not be loaded, so saving the
    // product does not erase its stored values.
    attributes?: AttributeValueInput[];
};
export type BannerInput = Omit<ManagedBanner, "id">;

const managementApi = baseApi.injectEndpoints({
    overrideExisting: process.env.NODE_ENV === "development",
    endpoints: (builder) => ({
        publicBanners: builder.query<
            z.infer<typeof publicBannerSchema>[],
            void
        >({
            query: () => "banners",
            transformResponse: (value: unknown) =>
                parseResponse(z.array(publicBannerSchema), value, "banners"),
            providesTags: ["Management"],
        }),
        managementStats: builder.query<z.infer<typeof statsSchema>, void>({
            query: () => "admin/stats",
            transformResponse: (value: unknown) =>
                parseResponse(statsSchema, value, "stats"),
            providesTags: ["Management"],
        }),
        managementUsers: builder.query<
            z.infer<typeof userSchema>[],
            { page: number; search?: string }
        >({
            query: (params) => ({
                url: "admin/users",
                params: { ...params, limit: 20 },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(z.array(userSchema), value, "users"),
            providesTags: ["Management"],
        }),
        managementUser: builder.query<z.infer<typeof userDetailSchema>, string>(
            {
                query: (id) => `admin/users/${encodeURIComponent(id)}`,
                transformResponse: (value: unknown) =>
                    parseResponse(userDetailSchema, value, "user"),
                providesTags: ["Management"],
            },
        ),
        managementOrders: builder.query<
            z.infer<typeof orderSchema>[],
            { page: number; status?: string }
        >({
            query: (params) => ({
                url: "admin/orders",
                params: { ...params, limit: 20 },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(z.array(orderSchema), value, "orders"),
            providesTags: ["Management"],
        }),
        managementOrder: builder.query<
            z.infer<typeof orderSchema> & {
                items: z.infer<typeof orderItemSchema>[];
            },
            string
        >({
            query: (id) => `admin/orders/${id}`,
            transformResponse: (value: unknown) =>
                parseResponse(
                    orderSchema.extend({ items: z.array(orderItemSchema) }),
                    value,
                    "order",
                ),
            providesTags: ["Management"],
        }),
        managementBanners: builder.query<ManagedBanner[], number>({
            query: (page) => ({
                url: "admin/banners",
                params: { page, limit: 20 },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(z.array(bannerSchema), value, "banners"),
            providesTags: ["Management"],
        }),
        managementCategories: builder.query<
            z.infer<typeof categorySchema>[],
            number
        >({
            query: (page) => ({
                url: "categories",
                params: { page, limit: 20 },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(z.array(categorySchema), value, "categories"),
            providesTags: ["Management"],
        }),
        managementSellers: builder.query<
            z.infer<typeof sellerSchema>[],
            number
        >({
            query: (page) => ({ url: "sellers", params: { page, limit: 100 } }),
            transformResponse: (value: unknown) =>
                parseResponse(z.array(sellerSchema), value, "sellers"),
        }),
        ownSeller: builder.query<z.infer<typeof sellerSchema> | null, void>({
            async queryFn(_arg, _api, _extra, baseQuery) {
                const result = await baseQuery("sellers/me");
                if (result.error) {
                    return result.error.status === 404
                        ? { data: null }
                        : { error: result.error };
                }
                const parsed = sellerSchema.safeParse(result.data);
                return parsed.success
                    ? { data: parsed.data }
                    : {
                          error: {
                              status: "CUSTOM_ERROR",
                              error: "Invalid seller response",
                          },
                      };
            },
            providesTags: ["SellerManagement"],
        }),
        saveSeller: builder.mutation<
            void,
            { exists: boolean; storeName: string; description: string | null }
        >({
            query: ({ exists, ...body }) => ({
                url: exists ? "sellers/me" : "sellers",
                method: exists ? "PATCH" : "POST",
                body,
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) =>
                error ? [] : ["SellerManagement"],
        }),
        saveProduct: builder.mutation<
            ManagedProduct,
            {
                role: "admin" | "seller";
                id?: string;
                input: ProductInput;
                sellerId?: string;
            }
        >({
            query: ({ role, id, input, sellerId }) => ({
                url: `${role === "admin" ? "admin/" : ""}products${id ? `/${id}` : ""}`,
                method: id ? "PATCH" : "POST",
                body: role === "admin" && !id ? { ...input, sellerId } : input,
            }),
            transformResponse: (value: unknown) =>
                parseResponse(productSchema, value, "product"),
            invalidatesTags: (_result, error) =>
                error ? [] : ["Management", "SellerManagement"],
        }),
        deleteProduct: builder.mutation<
            void,
            { role: "admin" | "seller"; id: string }
        >({
            query: ({ role, id }) => ({
                url: `${role === "admin" ? "admin/" : ""}products/${id}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) =>
                error ? [] : ["Management", "SellerManagement"],
        }),
        bulkProducts: builder.mutation<
            { changed: number },
            { role: "admin" | "seller"; ids: string[] } & (
                | { action: "delete" }
                | { action: "discount"; discountPercent: number }
            )
        >({
            query: ({ role, action, ids, ...input }) => ({
                url: `${role}/products/bulk/${action}`,
                method: "POST",
                body: { ids, ...input },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(
                    z.object({ changed: z.number().int().nonnegative() }),
                    value,
                    "bulk products",
                ),
            invalidatesTags: (_result, error) =>
                error
                    ? []
                    : [
                          "Management",
                          "SellerManagement",
                          "Cart",
                          "Orders",
                          "Favourites",
                          "Views",
                      ],
        }),
        uploadProductImage: builder.mutation<
            void,
            { role: "admin" | "seller"; productId: string; file: File }
        >({
            query: ({ role, productId, file }) => {
                const body = new FormData();
                body.set("file", file);
                return {
                    url: `${role === "admin" ? "admin/" : ""}products/${productId}/images`,
                    method: "POST",
                    body,
                };
            },
            transformResponse: () => undefined,
        }),
        deleteProductImage: builder.mutation<
            void,
            { role: "admin" | "seller"; productId: string; imageId: string }
        >({
            query: ({ role, productId, imageId }) => ({
                url: `${role === "admin" ? "admin/" : ""}products/${productId}/images/${imageId}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
        }),
        saveCategory: builder.mutation<void, { id?: string; name: string }>({
            query: ({ id, name }) => ({
                url: `categories${id ? `/${id}` : ""}`,
                method: id ? "PATCH" : "POST",
                body: { name },
            }),
            transformResponse: (value: unknown) => {
                parseResponse(categorySchema, value, "category");
            },
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        managementBrands: builder.query<Brand[], void>({
            query: () => "brands",
            transformResponse: (value: unknown) =>
                parseResponse(z.array(brandSchema), value, "brands"),
            providesTags: ["Management"],
        }),
        saveBrand: builder.mutation<void, { id?: string; name: string }>({
            query: ({ id, name }) => ({
                url: `admin/brands${id ? `/${id}` : ""}`,
                method: id ? "PATCH" : "POST",
                body: { name },
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        deleteBrand: builder.mutation<void, string>({
            query: (id) => ({ url: `admin/brands/${id}`, method: "DELETE" }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        // With a category: the attributes offered for it, its parent and
        // all categories.
        managementAttributes: builder.query<
            AttributeDefinition[],
            string | undefined
        >({
            query: (categoryId) => ({
                url: "attributes",
                params: categoryId ? { categoryId } : {},
            }),
            transformResponse: (value: unknown) =>
                parseResponse(
                    z.array(attributeDefinitionSchema),
                    value,
                    "attributes",
                ),
            providesTags: ["Management"],
        }),
        createAttribute: builder.mutation<void, AttributeDefinitionInput>({
            query: (input) => ({
                url: "admin/attributes",
                method: "POST",
                body: input,
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        deleteAttribute: builder.mutation<void, string>({
            query: (id) => ({
                url: `admin/attributes/${id}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        deleteCategory: builder.mutation<void, string>({
            query: (id) => ({ url: `categories/${id}`, method: "DELETE" }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        saveBanner: builder.mutation<void, { id?: string; input: BannerInput }>(
            {
                query: ({ id, input }) => ({
                    url: `admin/banners${id ? `/${id}` : ""}`,
                    method: id ? "PATCH" : "POST",
                    body: input,
                }),
                transformResponse: () => undefined,
                invalidatesTags: (_result, error) =>
                    error ? [] : ["Management"],
            },
        ),
        deleteBanner: builder.mutation<void, string>({
            query: (id) => ({ url: `admin/banners/${id}`, method: "DELETE" }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        saveUser: builder.mutation<
            void,
            {
                id?: string;
                input: {
                    name: string;
                    email?: string;
                    password?: string;
                    isAdmin: boolean;
                    emailVerified?: boolean;
                };
            }
        >({
            query: ({ id, input }) => ({
                url: `admin/users${id ? `/${encodeURIComponent(id)}` : ""}`,
                method: id ? "PATCH" : "POST",
                body: input,
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        deleteUser: builder.mutation<void, string>({
            query: (id) => ({
                url: `admin/users/${encodeURIComponent(id)}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Management"]),
        }),
        cancelManagedOrder: builder.mutation<void, string>({
            query: (id) => ({
                url: `admin/orders/${id}`,
                method: "PATCH",
                body: { status: "cancelled" },
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) =>
                error ? [] : ["Management", "Orders", "SellerManagement"],
        }),
        importCsv: builder.mutation<
            z.infer<typeof importResultSchema>,
            {
                resource: "products" | "users";
                csv: string;
                role?: "admin" | "seller";
            }
        >({
            query: ({ resource, csv, role = "admin" }) => ({
                url: `${role}/import/${resource}`,
                method: "POST",
                body: { csv },
            }),
            transformResponse: (value: unknown) =>
                parseResponse(importResultSchema, value, "import"),
            invalidatesTags: (_result, error) =>
                error ? [] : ["Management", "SellerManagement"],
        }),
    }),
});

export const {
    usePublicBannersQuery,
    useManagementStatsQuery,
    useManagementUsersQuery,
    useManagementUserQuery,
    useManagementOrdersQuery,
    useManagementOrderQuery,
    useManagementBannersQuery,
    useManagementCategoriesQuery,
    useManagementBrandsQuery,
    useSaveBrandMutation,
    useDeleteBrandMutation,
    useManagementAttributesQuery,
    useCreateAttributeMutation,
    useDeleteAttributeMutation,
    useManagementSellersQuery,
    useOwnSellerQuery,
    useSaveSellerMutation,
    useSaveProductMutation,
    useDeleteProductMutation,
    useBulkProductsMutation,
    useUploadProductImageMutation,
    useDeleteProductImageMutation,
    useSaveCategoryMutation,
    useDeleteCategoryMutation,
    useSaveBannerMutation,
    useDeleteBannerMutation,
    useSaveUserMutation,
    useDeleteUserMutation,
    useCancelManagedOrderMutation,
    useImportCsvMutation,
} = managementApi;
