// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Orders from "./Orders";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const id = "00000000-0000-4000-8000-000000000001";

describe("Orders", () => {
    it("shows order status, total, date, and detail link", async () => {
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/orders`, () =>
                HttpResponse.json([
                    {
                        id,
                        userId: "user-1",
                        status: "pending",
                        checkoutKey: null,
                        totalAmount: "12.50",
                        createdAt: "2026-01-02T03:04:05.000Z",
                        updatedAt: "2026-01-02T03:04:05.000Z",
                    },
                ]),
            ),
        );
        renderWithStore(<Orders />);
        expect(
            (
                await screen.findByRole("link", { name: `Order ${id}` })
            ).getAttribute("href"),
        ).toBe(`/orders/${id}`);
        expect(screen.getByText("Status: pending")).not.toBeNull();
        expect(screen.getByText("Total: $12.50")).not.toBeNull();
    });
});
