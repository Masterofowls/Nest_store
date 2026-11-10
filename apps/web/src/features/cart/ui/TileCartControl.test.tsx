// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import TileCartControl from "./TileCartControl";

const server = setupApiServer();
const product = makeProduct({ stockQuantity: 2 });
const cartId = "00000000-0000-4000-8000-000000000401";
const itemId = "00000000-0000-4000-8000-000000000402";
const buyer = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: false,
    image: null,
};

function cartItem(quantity: number) {
    return {
        id: itemId,
        cartId,
        productId: product.id,
        quantity,
        createdAt: "2026-11-10T00:00:00.000Z",
        updatedAt: "2026-11-10T00:00:00.000Z",
    };
}

function renderControl(stockQuantity = product.stockQuantity) {
    renderWithStore(
        <TileCartControl
            productId={product.id}
            productName={product.name}
            stockQuantity={stockQuantity}
        />,
    );
}

describe("TileCartControl", () => {
    it("sends a guest to sign in", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
        );
        renderControl();

        expect(
            (
                await screen.findByRole("link", { name: "Sign in to buy" })
            ).getAttribute("href"),
        ).toBe("/login");
    });

    it("disables buying when the product is out of stock", () => {
        renderControl(0);
        expect(
            screen.getByRole("button", { name: "Out of stock" }),
        ).toHaveProperty("disabled", true);
    });

    it("adds to the cart, then steps the quantity within stock and removes at one", async () => {
        let quantity = 0;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(buyer)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: cartId,
                    items:
                        quantity > 0
                            ? [
                                  {
                                      id: itemId,
                                      productId: product.id,
                                      quantity,
                                      product,
                                  },
                              ]
                            : [],
                }),
            ),
            http.post(`${api}/cart/items`, () => {
                quantity = 1;
                return HttpResponse.json(cartItem(1), { status: 201 });
            }),
            http.patch(`${api}/cart/items/${itemId}`, async ({ request }) => {
                const body = (await request.json()) as { quantity: number };
                quantity = body.quantity;
                return HttpResponse.json(cartItem(quantity));
            }),
            http.delete(`${api}/cart/items/${itemId}`, () => {
                quantity = 0;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        const user = userEvent.setup();
        renderControl();

        await user.click(
            await screen.findByRole("button", {
                name: `Add ${product.name} to cart`,
            }),
        );
        const more = await screen.findByRole("button", {
            name: `Add one more ${product.name}`,
        });
        expect(
            screen.getByRole("status", { name: `${product.name} in cart` })
                .textContent,
        ).toBe("1");

        await user.click(more);
        expect(
            await screen.findByRole("button", {
                name: `Remove one ${product.name}`,
            }),
        ).not.toBeNull();
        expect(
            screen.getByRole("button", {
                name: `Add one more ${product.name}`,
            }),
        ).toHaveProperty("disabled", true);

        await user.click(
            screen.getByRole("button", { name: `Remove one ${product.name}` }),
        );
        await user.click(
            await screen.findByRole("button", {
                name: `Remove ${product.name} from cart`,
            }),
        );
        expect(
            await screen.findByRole("button", {
                name: `Add ${product.name} to cart`,
            }),
        ).not.toBeNull();
    });
});
