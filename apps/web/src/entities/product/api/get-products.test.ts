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
import { getProducts } from "./get-products";

const api = "https://api.example.test";
const product = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Keyboard",
    description: null,
    sellerId: "00000000-0000-4000-8000-000000000002",
    categoryId: "00000000-0000-4000-8000-000000000003",
    stockQuantity: 2,
    discountPercent: 0,
    price: "29.99",
};
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getProducts", () => {
    it("requests the uncached endpoint and returns validated products", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        let capturedRequest: { url: string; method: string } | undefined;
        server.use(
            http.get(`${api}/products`, ({ request }) => {
                capturedRequest = {
                    url: request.url,
                    method: request.method,
                };
                return HttpResponse.json([product]);
            }),
        );

        await expect(getProducts(api)).resolves.toEqual([product]);
        expect(capturedRequest).toEqual({
            url: `${api}/products`,
            method: "GET",
        });
        expect(fetchSpy).toHaveBeenCalledWith(new URL("/products", api), {
            cache: "no-store",
        });
    });

    it("returns an empty list when no products exist", async () => {
        server.use(http.get(`${api}/products`, () => HttpResponse.json([])));
        await expect(getProducts(api)).resolves.toEqual([]);
    });

    it("preserves a base path when requesting products", async () => {
        const proxyBase = `${api}/backend/`;
        let requestedUrl: string | undefined;
        server.use(
            http.get(`${api}/backend/products`, ({ request }) => {
                requestedUrl = request.url;
                return HttpResponse.json([product]);
            }),
        );

        await expect(getProducts(proxyBase)).resolves.toEqual([product]);
        expect(requestedUrl).toBe(`${api}/backend/products`);
    });

    it.each([404, 500])("reports HTTP status %i", async (status) => {
        server.use(
            http.get(`${api}/products`, () =>
                HttpResponse.text("not JSON", { status }),
            ),
        );
        await expect(getProducts(api)).rejects.toThrow(
            `Product request failed (HTTP ${status})`,
        );
    });

    it("rejects malformed JSON", async () => {
        server.use(http.get(`${api}/products`, () => HttpResponse.text("{")));
        await expect(getProducts(api)).rejects.toBeInstanceOf(SyntaxError);
    });

    it("rejects an invalid product instead of returning an empty list", async () => {
        server.use(
            http.get(`${api}/products`, () =>
                HttpResponse.json([{ ...product, price: -1 }]),
            ),
        );
        await expect(getProducts(api)).rejects.toThrow(
            "Invalid product list response",
        );
    });

    it("propagates a network failure", async () => {
        server.use(http.get(`${api}/products`, () => HttpResponse.error()));
        await expect(getProducts(api)).rejects.toBeInstanceOf(TypeError);
    });

    it("rejects an invalid API base URL", async () => {
        await expect(getProducts("not-a-url")).rejects.toBeInstanceOf(
            TypeError,
        );
    });
});
