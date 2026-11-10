import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { parseProductList } from "@/entities/product/api/parse-product-list";
import type { ProductList } from "@/entities/product/model/product.schema";
import { parseProductImageList } from "@/entities/product-image/api/product-image.api";
import type { ProductImageList } from "@/entities/product-image/model/product-image.schema";
import { parseRatingList } from "@/entities/rating/api/rating.api";
import type { RatingList } from "@/entities/rating/model/rating.schema";
import { parseId } from "./response";

export const baseApi = createApi({
    reducerPath: "baseApi",
    baseQuery: fetchBaseQuery({
        baseUrl: "/backend/",
        credentials: "same-origin",
    }),
    endpoints: (builder) => ({
        getProducts: builder.query<ProductList, void>({
            query: () => "products",
            transformResponse: (response: unknown) =>
                parseProductList(response),
        }),
        getProductImages: builder.query<ProductImageList, string>({
            query: (productId) => `products/${parseId(productId)}/images`,
            transformResponse: (response: unknown) =>
                parseProductImageList(response),
        }),
        getProductRatings: builder.query<RatingList, string>({
            query: (productId) => ({
                url: `products/${parseId(productId)}/ratings`,
                params: { page: 1, limit: 3 },
            }),
            transformResponse: (response: unknown) => parseRatingList(response),
        }),
    }),
});

export const {
    useGetProductsQuery,
    useGetProductImagesQuery,
    useGetProductRatingsQuery,
} = baseApi;
