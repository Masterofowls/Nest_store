// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import AddToCart from "./AddToCart";

const server = setupApiServer();
const productId = "00000000-0000-4000-8000-000000000001";
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};

describe("AddToCart", () => {
    it("prompts guests to sign in", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
        );
        renderWithStore(<AddToCart productId={productId} quantity={2} />);
        expect(
            (
                await screen.findByRole("link", {
                    name: "Sign in to add to cart",
                })
            ).getAttribute("href"),
        ).toBe("/login");
    });

    it("adds the selected quantity and confirms success", async () => {
        let requestedQuantity = 0;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.post(`${api}/cart/items`, async ({ request }) => {
                const body = (await request.json()) as {
                    productId: string;
                    quantity: number;
                };
                requestedQuantity = body.quantity;
                return HttpResponse.json({
                    id: productId,
                    cartId: "00000000-0000-4000-8000-000000000002",
                    productId,
                    quantity: body.quantity,
                    createdAt: "2026-01-02T03:04:05.000Z",
                    updatedAt: "2026-01-02T03:04:05.000Z",
                });
            }),
        );
        renderWithStore(<AddToCart productId={productId} quantity={3} />);
        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Add to cart" }));
        expect((await screen.findByRole("status")).textContent).toBe(
            "Added to cart",
        );
        expect(requestedQuantity).toBe(3);
    });
});
