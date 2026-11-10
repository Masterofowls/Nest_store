// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import OrderDetail from "./OrderDetail";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const id = "00000000-0000-4000-8000-000000000001";
const order = {
    id,
    userId: "user-1",
    status: "pending",
    checkoutKey: null,
    totalAmount: "12.50",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    items: [
        {
            id: "00000000-0000-4000-8000-000000000002",
            orderId: id,
            productId: "00000000-0000-4000-8000-000000000003",
            productName: "Keyboard",
            quantity: 1,
            unitPrice: "12.50",
        },
    ],
};

describe("OrderDetail", () => {
    it("shows items and cancels a pending order", async () => {
        let status = "pending";
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/orders/${id}`, () =>
                HttpResponse.json({ ...order, status }),
            ),
            http.patch(`${api}/orders/${id}`, async ({ request }) => {
                expect(await request.json()).toEqual({ status: "cancelled" });
                status = "cancelled";
                return HttpResponse.json({ ...order, status });
            }),
        );
        renderWithStore(<OrderDetail orderId={id} />);
        expect(
            await screen.findByRole("link", { name: "Keyboard" }),
        ).not.toBeNull();
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Cancel order" }));
        expect(await screen.findByText("Status: cancelled")).not.toBeNull();
        expect(
            screen.queryByRole("button", { name: "Cancel order" }),
        ).toBeNull();
    });
});
