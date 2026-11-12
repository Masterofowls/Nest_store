// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { HttpResponse, http } from "msw";
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
import { makeStore } from "@/app/store";
import ProductList from "./ProductList";

const origin = "http://localhost";
const productId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const timestamp = "2026-01-02T03:04:05.000Z";
const product = {
    id: productId,
    name: "Keyboard",
    description: "Compact mechanical keyboard",
    sellerId: otherId,
    categoryId: otherId,
    stockQuantity: 4,
    discountPercent: 10,
    price: "29.99",
};
const server = setupServer();

class RelativeRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === "string" ? new URL(input, origin) : input, init);
    }
}

function renderProductList() {
    return render(
        <Provider store={makeStore()}>
            <ProductList />
        </Provider>,
    );
}

beforeAll(() => {
    server.listen({ onUnhandledFrame: "error" });
    vi.stubGlobal("Request", RelativeRequest);
});

afterEach(() => {
    cleanup();
    server.resetHandlers();
});

afterAll(() => {
    vi.unstubAllGlobals();
    server.close();
});

describe("ProductList", () => {
    it("renders product details, the first image, and the latest review score", async () => {
        let requestedProductQuery: URLSearchParams | undefined;
        let requestedLimit: string | null = null;
        server.use(
            http.get(`${origin}/backend/products`, ({ request }) => {
                requestedProductQuery = new URL(request.url).searchParams;
                return HttpResponse.json([product]);
            }),
            http.get(`${origin}/backend/products/${productId}/images`, () =>
                HttpResponse.json([
                    {
                        id: productId,
                        productId,
                        url: "https://images.example.test/keyboard.webp",
                        createdAt: timestamp,
                    },
                    {
                        id: otherId,
                        productId,
                        url: "https://images.example.test/keyboard-side.webp",
                        createdAt: timestamp,
                    },
                ]),
            ),
            http.get(
                `${origin}/backend/products/${productId}/ratings`,
                ({ request }) => {
                    requestedLimit = new URL(request.url).searchParams.get(
                        "limit",
                    );
                    return HttpResponse.json([
                        {
                            id: productId,
                            productId,
                            productName: product.name,
                            score: 4,
                            comment: "Solid keyboard.",
                            createdAt: timestamp,
                            updatedAt: timestamp,
                        },
                    ]);
                },
            ),
        );

        renderProductList();

        expect(
            await screen.findByRole("heading", { name: "Keyboard" }),
        ).not.toBeNull();
        expect(
            screen.getByRole("link", { name: "Keyboard" }).getAttribute("href"),
        ).toBe(`/products/${productId}`);
        expect(screen.getByText("$26.99")).not.toBeNull();
        expect(screen.getByText("$29.99")).not.toBeNull();
        expect(screen.getByText("Only 4 left")).not.toBeNull();
        expect(screen.getByText("−10%")).not.toBeNull();
        expect(await screen.findByText("latest review")).not.toBeNull();
        expect(screen.getByText("4")).not.toBeNull();
        expect(
            (
                await screen.findByRole("img", { name: "Image of Keyboard" })
            ).getAttribute("src"),
        ).toBe("https://images.example.test/keyboard.webp");
        expect(screen.queryByText("Average rating")).toBeNull();
        expect(requestedLimit).toBe("3");
        expect(requestedProductQuery?.get("page")).toBe("1");
        expect(requestedProductQuery?.get("limit")).toBe("10");
        expect(requestedProductQuery?.has("search")).toBe(false);
    });

    it("shows empty product image and review states", async () => {
        server.use(
            http.get(`${origin}/backend/products`, () =>
                HttpResponse.json([
                    { ...product, description: null, discountPercent: 0 },
                ]),
            ),
            http.get(`${origin}/backend/products/${productId}/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/${productId}/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        renderProductList();

        expect(
            await screen.findByText("No product image available."),
        ).not.toBeNull();
        expect(await screen.findByText("No reviews yet.")).not.toBeNull();
        expect(screen.getByText("$29.99")).not.toBeNull();
        expect(screen.queryByText(/%/)).toBeNull();
    });

    it("offers a retry when the product request fails", async () => {
        let shouldFail = true;
        server.use(
            http.get(`${origin}/backend/products`, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return new HttpResponse(null, { status: 500 });
                }

                return HttpResponse.json([product]);
            }),
            http.get(`${origin}/backend/products/${productId}/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/${productId}/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        renderProductList();

        expect(
            await screen.findByText("Couldn't load products."),
        ).not.toBeNull();
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Retry" }));
        expect(
            await screen.findByRole("heading", { name: "Keyboard" }),
        ).not.toBeNull();
    });

    it("shows independent errors for image and review requests", async () => {
        server.use(
            http.get(`${origin}/backend/products`, () =>
                HttpResponse.json([product]),
            ),
            http.get(
                `${origin}/backend/products/${productId}/images`,
                () => new HttpResponse(null, { status: 500 }),
            ),
            http.get(
                `${origin}/backend/products/${productId}/ratings`,
                () => new HttpResponse(null, { status: 500 }),
            ),
        );

        renderProductList();

        expect(
            await screen.findByText("Couldn't load product images."),
        ).not.toBeNull();
        expect(
            await screen.findByText("Couldn't load reviews."),
        ).not.toBeNull();
        expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(
            2,
        );
    });

    it("appends the next page when Show more is selected", async () => {
        server.use(
            http.get(`${origin}/backend/products`, ({ request }) => {
                const page = new URL(request.url).searchParams.get("page");
                return HttpResponse.json(
                    page === "2"
                        ? [
                              {
                                  ...product,
                                  id: "00000000-0000-4000-8000-000000000011",
                                  name: "Keyboard 11",
                              },
                          ]
                        : Array.from({ length: 10 }, (_, index) => ({
                              ...product,
                              id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                              name: `Keyboard ${index + 1}`,
                          })),
                );
            }),
            http.get(`${origin}/backend/products/:productId/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/:productId/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        renderProductList();
        await screen.findByRole("heading", { name: "Keyboard 1" });
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Show more" }));

        expect(
            await screen.findByRole("heading", { name: "Keyboard 11" }),
        ).not.toBeNull();
        expect(
            screen.getByRole("heading", { name: "Keyboard 1" }),
        ).not.toBeNull();
        await waitFor(() => {
            expect(
                screen.queryByRole("button", { name: "Show more" }),
            ).toBeNull();
        });
    });

    it("hides Show more after an empty page", async () => {
        server.use(
            http.get(`${origin}/backend/products`, ({ request }) => {
                const page = new URL(request.url).searchParams.get("page");
                return HttpResponse.json(
                    page === "2"
                        ? []
                        : Array.from({ length: 10 }, (_, index) => ({
                              ...product,
                              id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                              name: `Keyboard ${index + 1}`,
                          })),
                );
            }),
            http.get(`${origin}/backend/products/:productId/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/:productId/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        renderProductList();
        await screen.findByRole("heading", { name: "Keyboard 1" });
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Show more" }));

        await waitFor(() => {
            expect(
                screen.queryByRole("button", { name: "Show more" }),
            ).toBeNull();
        });
        expect(screen.getAllByRole("article")).toHaveLength(10);
    });
});
