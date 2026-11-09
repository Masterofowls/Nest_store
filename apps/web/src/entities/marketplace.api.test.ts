import { HttpResponse, http } from "msw/http";
import { setupServer } from "msw/node";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { ZodError } from "zod";
import { ApiError } from "../shared/api/response";
import {
    getCategories,
    getCategory,
    parseCategory,
    parseCategoryList,
} from "./category/api/category.api";
import {
    getOwnSeller,
    getSeller,
    getSellers,
    parseSeller,
    parseSellerList,
} from "./seller/api/seller.api";
import {
    getProductImages,
    parseProductImage,
    parseProductImageList,
} from "./product-image/api/product-image.api";
import {
    getCart,
    parseCart,
    parseCartItem,
    parseCartMutationItem,
} from "./cart/api/cart.api";
import {
    getOrder,
    getOrders,
    parseOrder,
    parseOrderDetail,
    parseOrderItem,
    parseOrderList,
} from "./order/api/order.api";
import {
    getFavourites,
    parseFavourite,
    parseFavouriteList,
} from "./favourite/api/favourite.api";
import {
    getOwnRatings,
    getProductRatings,
    parseRating,
    parseRatingList,
} from "./rating/api/rating.api";
import {
    getViewHistory,
    parseView,
    parseViewHistory,
    parseViewHistoryItem,
} from "./view/api/view.api";
import {
    getRecommendations,
    parseRecommendation,
    parseRecommendationList,
} from "./recommendation/api/recommendation.api";

const origin = "https://store.example.test";
const api = `${origin}/backend/`;
const id = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const date = "2026-01-02T03:04:05.000Z";
const product = {
    id,
    sellerId: otherId,
    categoryId: otherId,
    name: "Keyboard",
    description: null,
    stockQuantity: 4,
    discountPercent: 0,
    price: "29.99",
};
const category = { id, name: "Keyboards" };
const seller = {
    id,
    storeName: "Keyboard shop",
    description: null,
    createdAt: date,
    updatedAt: date,
};
const image = {
    id,
    productId: otherId,
    url: "https://images.example.test/keyboard.webp",
    createdAt: date,
};
const cartItem = { id, productId: product.id, quantity: 1, product };
const cartMutationItem = {
    id,
    cartId: otherId,
    productId: product.id,
    quantity: 1,
    createdAt: date,
    updatedAt: date,
};
const cart = { id, items: [cartItem] };
const orderItem = {
    id,
    orderId: otherId,
    productId: null,
    productName: "Keyboard",
    quantity: 1,
    unitPrice: "29.99",
};
const order = {
    id,
    userId: "user_123",
    status: "pending",
    checkoutKey: null,
    totalAmount: "29.99",
    createdAt: date,
    updatedAt: date,
};
const orderDetail = { ...order, items: [orderItem] };
const favourite = {
    id,
    productId: null,
    productName: "Keyboard",
    createdAt: date,
};
const rating = {
    id,
    productId: null,
    productName: "Keyboard",
    score: 5,
    comment: null,
    createdAt: date,
    updatedAt: date,
};
const view = { id, productId: otherId, viewedAt: date };
const historyItem = { ...view, productName: "Keyboard" };
const recommendation = { ...product, coViewers: 2 };
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const parsers: Array<{
    name: string;
    parse: (value: unknown) => unknown;
    valid: unknown;
}> = [
    { name: "category", parse: parseCategory, valid: category },
    { name: "category list", parse: parseCategoryList, valid: [category] },
    { name: "seller", parse: parseSeller, valid: seller },
    { name: "seller list", parse: parseSellerList, valid: [seller] },
    { name: "product image", parse: parseProductImage, valid: image },
    {
        name: "product image list",
        parse: parseProductImageList,
        valid: [image],
    },
    { name: "cart item", parse: parseCartItem, valid: cartItem },
    {
        name: "cart mutation item",
        parse: parseCartMutationItem,
        valid: cartMutationItem,
    },
    { name: "cart", parse: parseCart, valid: cart },
    { name: "order item", parse: parseOrderItem, valid: orderItem },
    { name: "order", parse: parseOrder, valid: order },
    { name: "order list", parse: parseOrderList, valid: [order] },
    { name: "order detail", parse: parseOrderDetail, valid: orderDetail },
    { name: "favourite", parse: parseFavourite, valid: favourite },
    { name: "favourite list", parse: parseFavouriteList, valid: [favourite] },
    { name: "rating", parse: parseRating, valid: rating },
    { name: "rating list", parse: parseRatingList, valid: [rating] },
    { name: "product view", parse: parseView, valid: view },
    {
        name: "view history item",
        parse: parseViewHistoryItem,
        valid: historyItem,
    },
    { name: "view history", parse: parseViewHistory, valid: [historyItem] },
    {
        name: "recommendation",
        parse: parseRecommendation,
        valid: recommendation,
    },
    {
        name: "recommendation list",
        parse: parseRecommendationList,
        valid: [recommendation],
    },
];

describe("marketplace response parsers", () => {
    it.each(parsers)("parses a valid $name", ({ parse, valid }) => {
        expect(parse(valid)).toEqual(valid);
    });

    it.each(parsers)(
        "preserves the Zod cause for an invalid $name",
        ({ parse }) => {
            expect(() => parse(null)).toThrow(
                expect.objectContaining({ cause: expect.any(ZodError) }),
            );
        },
    );

    it("accepts an empty cart and lists", () => {
        expect(parseCart({ id: null, items: [] })).toEqual({
            id: null,
            items: [],
        });
        for (const { parse } of parsers.filter(
            ({ name }) => name.endsWith("list") || name === "view history",
        )) {
            expect(parse([])).toEqual([]);
        }
    });

    it.each(
        parsers.filter(
            ({ name }) => name.endsWith("list") || name === "view history",
        ),
    )("rejects an invalid item in a $name", ({ parse }) => {
        expect(() => parse([null])).toThrow(
            expect.objectContaining({ cause: expect.any(ZodError) }),
        );
    });

    it("checks nested products, order items, ratings and timestamps", () => {
        expect(() =>
            parseCart({
                ...cart,
                items: [{ ...cartItem, product: { ...product, price: 1 } }],
            }),
        ).toThrow("Invalid cart response");
        expect(() =>
            parseOrderDetail({
                ...orderDetail,
                items: [{ ...orderItem, quantity: 0 }],
            }),
        ).toThrow("Invalid order detail response");
        expect(() => parseRating({ ...rating, score: 6 })).toThrow(
            "Invalid rating response",
        );
        expect(() =>
            parseSeller({ ...seller, createdAt: "not-a-date" }),
        ).toThrow("Invalid seller response");
        expect(() =>
            parseRecommendation({ ...recommendation, coViewers: 0 }),
        ).toThrow("Invalid recommendation response");
    });

    it("keeps list orders separate from order details", () => {
        expect(() => parseOrderDetail(order)).toThrow(
            "Invalid order detail response",
        );
        expect(parseOrderList([order])).toEqual([order]);
    });

    it("keeps cart read items separate from mutation responses", () => {
        expect(() => parseCartItem(cartMutationItem)).toThrow(
            "Invalid cart item response",
        );
        expect(() => parseCartMutationItem(cartItem)).toThrow(
            "Invalid cart mutation item response",
        );
    });
});

const requests: Array<{
    name: string;
    path: string;
    body: Parameters<typeof HttpResponse.json>[0];
    run: () => Promise<unknown>;
}> = [
    {
        name: "categories",
        path: "categories",
        body: [category],
        run: () => getCategories(api),
    },
    {
        name: "category",
        path: `categories/${id}`,
        body: category,
        run: () => getCategory(api, id),
    },
    {
        name: "sellers",
        path: "sellers",
        body: [seller],
        run: () => getSellers(api),
    },
    {
        name: "seller",
        path: `sellers/${id}`,
        body: seller,
        run: () => getSeller(api, id),
    },
    {
        name: "own seller",
        path: "sellers/me",
        body: seller,
        run: () => getOwnSeller(api),
    },
    {
        name: "images",
        path: `products/${id}/images`,
        body: [image],
        run: () => getProductImages(api, id),
    },
    { name: "cart", path: "cart", body: cart, run: () => getCart(api) },
    {
        name: "orders",
        path: "orders",
        body: [order],
        run: () => getOrders(api),
    },
    {
        name: "order",
        path: `orders/${id}`,
        body: orderDetail,
        run: () => getOrder(api, id),
    },
    {
        name: "favourites",
        path: "favourites",
        body: [favourite],
        run: () => getFavourites(api),
    },
    {
        name: "own ratings",
        path: "ratings",
        body: [rating],
        run: () => getOwnRatings(api),
    },
    {
        name: "product ratings",
        path: `products/${id}/ratings`,
        body: [rating],
        run: () => getProductRatings(api, id),
    },
    {
        name: "view history",
        path: "users/me/views",
        body: [historyItem],
        run: () => getViewHistory(api),
    },
    {
        name: "recommendations",
        path: `products/${id}/recommendations`,
        body: [recommendation],
        run: () => getRecommendations(api, id),
    },
];

describe("marketplace GET requests", () => {
    it.each(requests)(
        "requests and validates $name through the base path",
        async ({ path, body, run }) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            server.use(
                http.get(`${api}${path}`, () => HttpResponse.json(body)),
            );
            await expect(run()).resolves.toEqual(body);
            expect(fetchSpy).toHaveBeenCalledWith(new URL(path, api), {
                cache: "no-store",
                credentials: "same-origin",
            });
        },
    );

    it.each(requests)(
        "reports HTTP failures for $name",
        async ({ path, run }) => {
            server.use(
                http.get(`${api}${path}`, () =>
                    HttpResponse.text("not JSON", { status: 401 }),
                ),
            );
            await expect(run()).rejects.toMatchObject({
                name: "ApiError",
                status: 401,
            });
        },
    );

    it.each(requests)(
        "rejects an invalid $name response",
        async ({ path, run }) => {
            server.use(
                http.get(`${api}${path}`, () => HttpResponse.json(null)),
            );
            await expect(run()).rejects.toThrow(
                expect.objectContaining({ cause: expect.any(ZodError) }),
            );
        },
    );

    it("sends supported query parameters and trims search", async () => {
        let query = "";
        server.use(
            http.get(`${api}categories`, ({ request }) => {
                query = new URL(request.url).search;
                return HttpResponse.json([category]);
            }),
        );
        await expect(
            getCategories(api, { page: 2, limit: 3, search: " keys " }),
        ).resolves.toEqual([category]);
        expect(query).toBe("?page=2&limit=3&search=keys");
    });

    it("supports order status filters", async () => {
        let query = "";
        server.use(
            http.get(`${api}orders`, ({ request }) => {
                query = new URL(request.url).search;
                return HttpResponse.json([]);
            }),
        );
        await expect(getOrders(api, { status: "cancelled" })).resolves.toEqual(
            [],
        );
        expect(query).toBe("?status=cancelled");
    });

    it("omits undefined query values", async () => {
        let query = "not captured";
        server.use(
            http.get(`${api}cart`, ({ request }) => {
                query = new URL(request.url).search;
                return HttpResponse.json({ id: null, items: [] });
            }),
        );
        await expect(getCart(api, { limit: undefined })).resolves.toEqual({
            id: null,
            items: [],
        });
        expect(query).toBe("");
    });

    it("rejects invalid IDs, pagination and base paths before fetch", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(
            getProductImages(api, "../ratings"),
        ).rejects.toBeInstanceOf(ZodError);
        await expect(getCart(api, { page: 0 })).rejects.toBeInstanceOf(
            ZodError,
        );
        await expect(getCart(api, { limit: 101 })).rejects.toBeInstanceOf(
            ZodError,
        );
        for (const invalidBase of [
            `${origin}/backend`,
            `${api}?`,
            `${api}#`,
            "ftp://store.example.test/",
            "https://user:password@store.example.test/",
        ]) {
            await expect(getCart(invalidBase)).rejects.toThrow("API base must");
        }
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("preserves HTTP status, invalid JSON and network failures", async () => {
        server.use(
            http.get(`${api}cart`, () =>
                HttpResponse.text("failure", { status: 500 }),
            ),
        );
        await expect(getCart(api)).rejects.toBeInstanceOf(ApiError);
        await expect(getCart(api)).rejects.toMatchObject({ status: 500 });
        server.use(http.get(`${api}cart`, () => HttpResponse.text("{")));
        await expect(getCart(api)).rejects.toBeInstanceOf(SyntaxError);
        server.use(http.get(`${api}cart`, () => HttpResponse.error()));
        await expect(getCart(api)).rejects.toBeInstanceOf(TypeError);
    });
});
