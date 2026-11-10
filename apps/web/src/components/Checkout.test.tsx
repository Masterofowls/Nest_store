// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Checkout from "./Checkout";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    discountPercent: 0,
    price: "10.00",
};
const orderId = "00000000-0000-4000-8000-000000000006";

describe("Checkout", () => {
    it("sends no card details and navigates to the created order", async () => {
        let body: unknown;
        let key = "";
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000005",
                    items: [
                        {
                            id: "00000000-0000-4000-8000-000000000004",
                            productId: product.id,
                            quantity: 1,
                            product,
                        },
                    ],
                }),
            ),
            http.post(`${api}/orders`, async ({ request }) => {
                body = await request.json();
                key = request.headers.get("Idempotency-Key") ?? "";
                return HttpResponse.json({
                    id: orderId,
                    userId: "user-1",
                    status: "pending",
                    checkoutKey: key,
                    totalAmount: "10.00",
                    createdAt: "2026-01-02T03:04:05.000Z",
                    updatedAt: "2026-01-02T03:04:05.000Z",
                    items: [
                        {
                            id: "00000000-0000-4000-8000-000000000007",
                            orderId,
                            productId: product.id,
                            productName: product.name,
                            quantity: 1,
                            unitPrice: "10.00",
                        },
                    ],
                });
            }),
        );
        renderWithStore(<Checkout />);
        const events = userEvent.setup();
        await events.type(
            await screen.findByLabelText("Cardholder name"),
            "Test Buyer",
        );
        await events.type(
            screen.getByLabelText("Card number"),
            "4111111111111111",
        );
        await events.type(screen.getByLabelText("Expiry (MM/YY)"), "12/99");
        await events.type(screen.getByLabelText("CVC"), "123");
        await events.click(
            screen.getByRole("button", { name: "Place test order" }),
        );
        expect(
            await screen.findByRole("heading", { name: "Checkout" }),
        ).not.toBeNull();
        expect(body).toEqual({});
        expect(key).toMatch(/^[0-9a-f-]{36}$/i);
        expect(push).toHaveBeenCalledWith(`/orders/${orderId}`);
    });

    it("explains checkout conflicts from an empty or changed cart", async () => {
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000005",
                    items: [
                        {
                            id: "00000000-0000-4000-8000-000000000004",
                            productId: product.id,
                            quantity: 1,
                            product,
                        },
                    ],
                }),
            ),
            http.post(`${api}/orders`, () =>
                HttpResponse.json(
                    { message: "Cart is empty" },
                    { status: 409 },
                ),
            ),
        );
        renderWithStore(<Checkout />);
        const events = userEvent.setup();
        await events.type(
            await screen.findByLabelText("Cardholder name"),
            "Test Buyer",
        );
        await events.type(
            screen.getByLabelText("Card number"),
            "4111111111111111",
        );
        await events.type(screen.getByLabelText("Expiry (MM/YY)"), "12/99");
        await events.type(screen.getByLabelText("CVC"), "123");
        await events.click(
            screen.getByRole("button", { name: "Place test order" }),
        );
        expect(
            await screen.findByText(
                "Your cart changed or an item is out of stock. Review your cart and try again.",
            ),
        ).not.toBeNull();
    });

    it("reports invalid card data before making a request", async () => {
        let orderRequests = 0;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000005",
                    items: [
                        {
                            id: "00000000-0000-4000-8000-000000000004",
                            productId: product.id,
                            quantity: 1,
                            product,
                        },
                    ],
                }),
            ),
            http.post(`${api}/orders`, () => {
                orderRequests += 1;
                return HttpResponse.json({});
            }),
        );
        renderWithStore(<Checkout />);
        const events = userEvent.setup();
        await events.type(
            await screen.findByLabelText("Cardholder name"),
            "Test Buyer",
        );
        await events.type(
            screen.getByLabelText("Card number"),
            "4111111111111112",
        );
        await events.type(screen.getByLabelText("Expiry (MM/YY)"), "12/99");
        await events.type(screen.getByLabelText("CVC"), "123");
        await events.click(
            screen.getByRole("button", { name: "Place test order" }),
        );
        expect(
            await screen.findByText("Enter a valid card number"),
        ).not.toBeNull();
        expect(orderRequests).toBe(0);
    });
});
