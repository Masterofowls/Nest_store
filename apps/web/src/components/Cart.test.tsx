// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Cart from "./Cart";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const product = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Keyboard",
    description: null,
    sellerId: "00000000-0000-4000-8000-000000000002",
    categoryId: "00000000-0000-4000-8000-000000000003",
    stockQuantity: 9,
    discountPercent: 10,
    price: "10.00",
};
const cartItem = {
    id: "00000000-0000-4000-8000-000000000004",
    productId: product.id,
    quantity: 2,
    product,
};

describe("Cart", () => {
    it("shows discounted line totals and lets the user update quantity", async () => {
        let quantity = 2;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000005",
                    items: [{ ...cartItem, quantity }],
                }),
            ),
            http.patch(
                `${api}/cart/items/${cartItem.id}`,
                async ({ request }) => {
                    quantity = ((await request.json()) as { quantity: number })
                        .quantity;
                    return HttpResponse.json({
                        id: cartItem.id,
                        cartId: "00000000-0000-4000-8000-000000000005",
                        productId: product.id,
                        quantity,
                        createdAt: "2026-01-02T03:04:05.000Z",
                        updatedAt: "2026-01-02T03:04:05.000Z",
                    });
                },
            ),
        );
        renderWithStore(<Cart />);
        expect(await screen.findAllByText("$18.00")).toHaveLength(2);
        expect(screen.getByText("$9.00")).not.toBeNull();
        await userEvent.setup().click(
            screen.getByRole("button", {
                name: "Increase Keyboard quantity",
            }),
        );
        expect(await screen.findAllByText("$27.00")).toHaveLength(2);
        expect(
            screen.getByRole("link", { name: "Checkout" }).getAttribute("href"),
        ).toBe("/checkout");
    });

    it("removes a cart item", async () => {
        let hasItem = true;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000005",
                    items: hasItem ? [cartItem] : [],
                }),
            ),
            http.delete(`${api}/cart/items/${cartItem.id}`, () => {
                hasItem = false;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        renderWithStore(<Cart />);
        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Remove" }));
        expect(await screen.findByText("Your cart is empty.")).not.toBeNull();
    });

    it("shows the empty cart message", async () => {
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({ id: null, items: [] }),
            ),
        );
        renderWithStore(<Cart />);
        expect(await screen.findByText("Your cart is empty.")).not.toBeNull();
        expect(
            screen
                .getByRole("link", { name: "Browse the catalog" })
                .getAttribute("href"),
        ).toBe("/catalog");
    });
});
