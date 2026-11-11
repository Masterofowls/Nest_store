import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { parseCart, parseCartMutationItem } from "@/entities/cart/api/cart.api";
import type { Cart, CartMutationItem } from "@/entities/cart/model/cart.schema";
import { parseCategoryList } from "@/entities/category/api/category.api";
import {
    parseFavourite,
    parseFavouriteList,
} from "@/entities/favourite/api/favourite.api";
import type { Favourite } from "@/entities/favourite/model/favourite.schema";
import type { FavouriteList } from "@/entities/favourite/model/favourite.schema";
import {
    parseOrderDetail,
    parseOrderList,
} from "@/entities/order/api/order.api";
import type {
    OrderDetail,
    OrderList,
} from "@/entities/order/model/order.schema";
import type { CategoryList } from "@/entities/category/model/category.schema";
import { parseProductList } from "@/entities/product/api/parse-product-list";
import {
    productDetailListSchema,
    productDetailSchema,
    productFacetsSchema,
    type ProductDetail,
    type ProductFacets,
    type ProductList,
} from "@/entities/product/model/product.schema";
import { parseProductImageList } from "@/entities/product-image/api/product-image.api";
import type { ProductImageList } from "@/entities/product-image/model/product-image.schema";
import { parseRatingList } from "@/entities/rating/api/rating.api";
import { parseSeller } from "@/entities/seller/api/seller.api";
import type { Seller } from "@/entities/seller/model/seller.schema";
import { parseView, parseViewHistory } from "@/entities/view/api/view.api";
import type {
    ProductView,
    ViewHistory,
} from "@/entities/view/model/view.schema";
import type { RatingList } from "@/entities/rating/model/rating.schema";
import { parseRecommendationList } from "@/entities/recommendation/api/recommendation.api";
import type { RecommendationList } from "@/entities/recommendation/model/recommendation.schema";
import {
    signInSchema,
    type SignInInput,
} from "@/entities/user/model/sign-in.schema";
import {
    signUpSchema,
    type SignUpInput,
} from "@/entities/user/model/sign-up.schema";
import {
    currentUserSchema,
    type CurrentUser,
} from "@/entities/user/model/user.schema";
import {
    parseId,
    parseProductReference,
    parseResponse,
    productQuerySchema,
    type ProductQuery,
} from "./response";

export const MAX_COMPARED_PRODUCTS = 4;

export const baseApi = createApi({
    reducerPath: "baseApi",
    baseQuery: fetchBaseQuery({
        baseUrl: "/backend/",
        credentials: "same-origin",
    }),
    tagTypes: [
        "CurrentUser",
        "Cart",
        "Orders",
        "Favourites",
        "Views",
        "Management",
        "SellerManagement",
    ],
    endpoints: (builder) => ({
        getCurrentUser: builder.query<CurrentUser | null, void>({
            async queryFn(_arg, _api, _extraOptions, baseQuery) {
                const result = await baseQuery("users/me");
                if (result.error) {
                    return result.error.status === 401
                        ? { data: null }
                        : { error: result.error };
                }
                const user = currentUserSchema.safeParse(result.data);
                return user.success
                    ? { data: user.data }
                    : {
                          error: {
                              status: "CUSTOM_ERROR",
                              error: "Invalid current user response",
                          },
                      };
            },
            providesTags: ["CurrentUser"],
        }),
        signIn: builder.mutation<void, SignInInput>({
            query: (input) => ({
                url: "api/auth/sign-in/email",
                method: "POST",
                body: signInSchema.parse(input),
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) =>
                error
                    ? []
                    : [
                          "CurrentUser",
                          "Cart",
                          "Orders",
                          "Favourites",
                          "Views",
                          "Management",
                          "SellerManagement",
                      ],
        }),
        signUp: builder.mutation<void, SignUpInput>({
            query: (input) => ({
                url: "api/auth/sign-up/email",
                method: "POST",
                body: signUpSchema.parse(input),
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) =>
                error
                    ? []
                    : [
                          "CurrentUser",
                          "Cart",
                          "Orders",
                          "Favourites",
                          "Views",
                          "Management",
                          "SellerManagement",
                      ],
        }),
        signOut: builder.mutation<void, void>({
            query: () => ({ url: "api/auth/sign-out", method: "POST" }),
            transformResponse: () => undefined,
            invalidatesTags: [
                "CurrentUser",
                "Cart",
                "Orders",
                "Favourites",
                "Views",
                "Management",
                "SellerManagement",
            ],
        }),
        getCategories: builder.query<CategoryList, void>({
            query: () => ({
                url: "categories",
                params: { page: 1, limit: 100 },
            }),
            transformResponse: (response: unknown) =>
                parseCategoryList(response),
            providesTags: ["Management"],
        }),
        getProductRecommendations: builder.query<RecommendationList, string>({
            query: (productId) => ({
                url: `products/${parseId(productId)}/recommendations`,
                params: { page: 1, limit: 4 },
            }),
            transformResponse: (response: unknown) =>
                parseRecommendationList(response),
        }),
        getProduct: builder.query<ProductDetail, string>({
            query: (reference) =>
                `products/${parseProductReference(reference)}`,
            transformResponse: (response: unknown) =>
                parseResponse(productDetailSchema, response, "product"),
            providesTags: ["Management", "SellerManagement"],
        }),
        getProductFacets: builder.query<ProductFacets, ProductQuery>({
            query: (params) => ({
                url: "products/facets",
                params: productQuerySchema.parse(params),
            }),
            transformResponse: (response: unknown) =>
                parseResponse(productFacetsSchema, response, "product facets"),
            providesTags: ["Management", "SellerManagement"],
        }),
        getComparedProducts: builder.query<ProductDetail[], string[]>({
            query: (ids) => ({
                url: "products/compare",
                params: {
                    ids: ids
                        .slice(0, MAX_COMPARED_PRODUCTS)
                        .map(parseId)
                        .join(","),
                },
            }),
            transformResponse: (response: unknown) =>
                parseResponse(
                    productDetailListSchema,
                    response,
                    "compared products",
                ),
            providesTags: ["Management", "SellerManagement"],
        }),
        getProducts: builder.query<ProductList, ProductQuery>({
            query: (params) => ({
                url: "products",
                params: productQuerySchema.parse(params),
            }),
            transformResponse: (response: unknown) =>
                parseProductList(response),
            providesTags: ["Management", "SellerManagement"],
        }),
        getCart: builder.query<Cart, void>({
            query: () => ({ url: "cart", params: { page: 1, limit: 100 } }),
            transformResponse: (response: unknown) => parseCart(response),
            providesTags: ["Cart"],
        }),
        addCartItem: builder.mutation<
            CartMutationItem,
            { productId: string; quantity: number }
        >({
            query: ({ productId, quantity }) => ({
                url: "cart/items",
                method: "POST",
                body: { productId: parseId(productId), quantity },
            }),
            transformResponse: (response: unknown) =>
                parseCartMutationItem(response),
            invalidatesTags: (_result, error) => (error ? [] : ["Cart"]),
        }),
        updateCartItem: builder.mutation<
            CartMutationItem,
            { id: string; quantity: number }
        >({
            query: ({ id, quantity }) => ({
                url: `cart/items/${parseId(id)}`,
                method: "PATCH",
                body: { quantity },
            }),
            transformResponse: (response: unknown) =>
                parseCartMutationItem(response),
            invalidatesTags: (_result, error) => (error ? [] : ["Cart"]),
        }),
        removeCartItem: builder.mutation<void, string>({
            query: (id) => ({
                url: `cart/items/${parseId(id)}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Cart"]),
        }),
        checkout: builder.mutation<OrderDetail, string>({
            query: (idempotencyKey) => ({
                url: "orders",
                method: "POST",
                headers: { "Idempotency-Key": parseId(idempotencyKey) },
                body: {},
            }),
            transformResponse: (response: unknown) =>
                parseOrderDetail(response),
            invalidatesTags: (_result, error) =>
                error ? [] : ["Cart", "Orders"],
        }),
        getOrders: builder.query<OrderList, void>({
            query: () => ({ url: "orders", params: { page: 1, limit: 100 } }),
            transformResponse: (response: unknown) => parseOrderList(response),
            providesTags: (orders = []) => [
                "Orders",
                ...orders.map((order) => ({
                    type: "Orders" as const,
                    id: order.id,
                })),
            ],
        }),
        getOrder: builder.query<OrderDetail, string>({
            query: (id) => `orders/${parseId(id)}`,
            transformResponse: (response: unknown) =>
                parseOrderDetail(response),
            providesTags: (_result, _error, id) => [{ type: "Orders", id }],
        }),
        cancelOrder: builder.mutation<OrderDetail, string>({
            query: (id) => ({
                url: `orders/${parseId(id)}`,
                method: "PATCH",
                body: { status: "cancelled" },
            }),
            transformResponse: (response: unknown) =>
                parseOrderDetail(response),
            invalidatesTags: (_result, error, id) =>
                error ? [] : ["Orders", { type: "Orders", id }],
        }),
        getFavourites: builder.query<FavouriteList, void>({
            query: () => ({
                url: "favourites",
                params: { page: 1, limit: 100 },
            }),
            transformResponse: (response: unknown) =>
                parseFavouriteList(response),
            providesTags: (favourites = []) => [
                "Favourites",
                ...favourites.map((favourite) => ({
                    type: "Favourites" as const,
                    id: favourite.id,
                })),
            ],
        }),
        addFavourite: builder.mutation<Favourite, { productId: string }>({
            query: ({ productId }) => ({
                url: "favourites",
                method: "POST",
                body: { productId: parseId(productId) },
            }),
            transformResponse: (response: unknown) => parseFavourite(response),
            invalidatesTags: (_result, error) => (error ? [] : ["Favourites"]),
        }),
        removeFavourite: builder.mutation<void, string>({
            query: (id) => ({
                url: `favourites/${parseId(id)}`,
                method: "DELETE",
            }),
            transformResponse: () => undefined,
            invalidatesTags: (_result, error) => (error ? [] : ["Favourites"]),
        }),
        recordProductView: builder.mutation<ProductView, string>({
            query: (productId) => ({
                url: `products/${parseId(productId)}/views`,
                method: "POST",
                body: {},
            }),
            transformResponse: (response: unknown) => parseView(response),
            invalidatesTags: (_result, error) => (error ? [] : ["Views"]),
        }),
        getViewHistory: builder.query<ViewHistory, void>({
            query: () => ({
                url: "users/me/views",
                params: { page: 1, limit: 100 },
            }),
            transformResponse: (response: unknown) =>
                parseViewHistory(response),
            providesTags: ["Views"],
        }),
        getSeller: builder.query<Seller, string>({
            query: (id) => `sellers/${parseId(id)}`,
            transformResponse: (response: unknown) => parseSeller(response),
        }),
        getSellerProducts: builder.query<ProductList, ProductQuery>({
            query: (params) => ({
                url: "products",
                params: productQuerySchema.parse(params),
            }),
            transformResponse: (response: unknown) =>
                parseProductList(response),
            providesTags: ["Management", "SellerManagement"],
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
        getProductReviews: builder.query<RatingList, string>({
            query: (productId) => ({
                url: `products/${parseId(productId)}/ratings`,
                params: { page: 1, limit: 100 },
            }),
            transformResponse: (response: unknown) => parseRatingList(response),
        }),
        // One cache entry per filter set; each new page is appended to it.
        getProductFeed: builder.query<
            ProductList,
            ProductQuery & { page: number }
        >({
            query: (params) => ({
                url: "products",
                params: productQuerySchema.parse(params),
            }),
            transformResponse: (response: unknown) =>
                parseProductList(response),
            serializeQueryArgs: ({ queryArgs }) => {
                const { page: _page, ...filters } = queryArgs;
                return filters;
            },
            merge: (cached, incoming, { arg }) => {
                if (arg.page === 1) return incoming;
                const seen = new Set(cached.map((product) => product.id));
                cached.push(...incoming.filter((item) => !seen.has(item.id)));
            },
            forceRefetch: ({ currentArg, previousArg }) =>
                currentArg?.page !== previousArg?.page,
            providesTags: ["Management", "SellerManagement"],
        }),
    }),
});

export const {
    useGetCurrentUserQuery,
    useSignInMutation,
    useSignUpMutation,
    useSignOutMutation,
    useGetCategoriesQuery,
    useGetProductRecommendationsQuery,
    useGetProductQuery,
    useGetProductFacetsQuery,
    useGetComparedProductsQuery,
    useGetProductsQuery,
    useGetProductImagesQuery,
    useGetProductRatingsQuery,
    useGetProductReviewsQuery,
    useGetProductFeedQuery,
    useGetCartQuery,
    useAddCartItemMutation,
    useUpdateCartItemMutation,
    useRemoveCartItemMutation,
    useCheckoutMutation,
    useGetOrdersQuery,
    useGetOrderQuery,
    useCancelOrderMutation,
    useGetFavouritesQuery,
    useAddFavouriteMutation,
    useRemoveFavouriteMutation,
    useRecordProductViewMutation,
    useGetViewHistoryQuery,
    useGetSellerQuery,
    useGetSellerProductsQuery,
} = baseApi;
