// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
import ProductItem from "./ProductItem";

const origin = "http://localhost";
const productId = "00000000-0000-4000-8000-000000000001";
const sellerId = "00000000-0000-4000-8000-000000000002";
const categoryId = "00000000-0000-4000-8000-000000000003";
const timestamp = "2026-01-02T03:04:05.000Z";
const product = {
    id: productId,
    name: "Mechanical Keyboard",
    description: "Compact mechanical keyboard",
    sellerId,
    categoryId,
    stockQuantity: 24,
    discountPercent: 10,
    price: "89.99",
};
const server = setupServer();

class RelativeRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === "string" ? new URL(input, origin) : input, init);
    }
}

function renderProductItem() {
    return render(
        <Provider store={makeStore()}>
            <ProductItem productId={productId} />
        </Provider>,
    );
}

function mockProductDetails() {
    server.use(
        http.get(`${origin}/backend/users/me`, () =>
            HttpResponse.json(null, { status: 401 }),
        ),
        http.get(`${origin}/backend/products/${productId}`, () =>
            HttpResponse.json(product),
        ),
        http.get(`${origin}/backend/products/${productId}/images`, () =>
            HttpResponse.json([]),
        ),
        http.get(`${origin}/backend/products/${productId}/ratings`, () =>
            HttpResponse.json([]),
        ),
        http.get(
            `${origin}/backend/products/${productId}/recommendations`,
            () => HttpResponse.json([]),
        ),
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

describe("ProductItem", () => {
    it("loads the selected product and its image and reviews", async () => {
        let requestedProductId = "";
        mockProductDetails();
        server.use(
            http.get(`${origin}/backend/products/:id`, ({ params }) => {
                requestedProductId = String(params.id);
                return HttpResponse.json(product);
            }),
            http.get(`${origin}/backend/products/${productId}/images`, () =>
                HttpResponse.json([
                    {
                        id: productId,
                        productId,
                        url: "https://images.example.test/keyboard.webp",
                        createdAt: timestamp,
                    },
                ]),
            ),
            http.get(`${origin}/backend/products/${productId}/ratings`, () =>
                HttpResponse.json([
                    {
                        id: productId,
                        productId,
                        productName: product.name,
                        score: 5,
                        comment: "Good key feel.",
                        createdAt: timestamp,
                        updatedAt: timestamp,
                    },
                ]),
            ),
        );

        renderProductItem();

        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Mechanical Keyboard",
            }),
        ).not.toBeNull();
        expect(requestedProductId).toBe(productId);
        expect(screen.getByText("$80.99")).not.toBeNull();
        expect(screen.getByText("$89.99")).not.toBeNull();
        expect(screen.getByText("24 in stock")).not.toBeNull();
        expect(await screen.findByText("Score: 5 out of 5")).not.toBeNull();
        expect(screen.getByText("5 stars")).not.toBeNull();
        expect(screen.getByText("1 review")).not.toBeNull();
        expect(await screen.findByText("Good key feel.")).not.toBeNull();
        expect(
            (
                await screen.findByRole("img", {
                    name: "Image of Mechanical Keyboard",
                })
            ).getAttribute("src"),
        ).toBe("https://images.example.test/keyboard.webp");
        expect(
            screen
                .getByRole("link", { name: "Back to products" })
                .getAttribute("href"),
        ).toBe("/");
    });

    it("shows empty states when the product has no image or reviews", async () => {
        mockProductDetails();
        renderProductItem();

        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Mechanical Keyboard",
            }),
        ).not.toBeNull();
        expect(
            await screen.findByText("No product image available."),
        ).not.toBeNull();
        expect(await screen.findByText("No reviews yet.")).not.toBeNull();
    });

    it("allows retrying a failed product request", async () => {
        let shouldFail = true;
        mockProductDetails();
        server.use(
            http.get(`${origin}/backend/products/${productId}`, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json(product);
            }),
        );

        renderProductItem();
        expect(
            await screen.findByText("Couldn't load this product."),
        ).not.toBeNull();

        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Retry" }));

        expect(
            await screen.findByRole("heading", {
                level: 1,
                name: "Mechanical Keyboard",
            }),
        ).not.toBeNull();
    });

    it("prices the selected quantity and shows recommendations", async () => {
        mockProductDetails();
        server.use(
            http.get(`${origin}/backend/products/${productId}`, () =>
                HttpResponse.json({ ...product, stockQuantity: 2 }),
            ),
            http.get(
                `${origin}/backend/products/${productId}/recommendations`,
                () =>
                    HttpResponse.json([
                        {
                            ...product,
                            id: "00000000-0000-4000-8000-000000000005",
                            name: "Wrist Rest",
                            coViewers: 2,
                        },
                    ]),
            ),
        );
        renderProductItem();

        const increase = await screen.findByRole("button", {
            name: "Increase",
        });
        expect(screen.getByText("Unit price: 89.99")).not.toBeNull();

        await userEvent.setup().click(increase);

        expect(screen.getByText("Total: 179.98")).not.toBeNull();
        expect(increase).toHaveProperty("disabled", true);
        expect(
            await screen.findByRole("link", { name: "Wrist Rest" }),
        ).not.toBeNull();
    });

    it("replaces the quantity selector when the product is out of stock", async () => {
        mockProductDetails();
        server.use(
            http.get(`${origin}/backend/products/${productId}`, () =>
                HttpResponse.json({ ...product, stockQuantity: 0 }),
            ),
        );
        renderProductItem();

        expect(await screen.findByText("Out of stock")).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Increase" })).toBeNull();
    });
});
