// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import AdminDashboard from "./AdminDashboard";
import SellerDashboard from "./SellerDashboard";

const server = setupApiServer();
const user = {
    id: "buyer",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const seller = {
    id: "00000000-0000-4000-8000-000000000002",
    storeName: "Buyer store",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};
const stats = {
    users: 1,
    admins: 1,
    sellers: 1,
    products: 2,
    outOfStockProducts: 0,
    categories: 1,
    orders: 1,
    pendingOrders: 1,
    revenue: "12.00",
};

describe("management access", () => {
    it("does not fetch admin data for a non-admin", async () => {
        const statsRequest = vi.fn<() => void>();
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/admin/stats`, () => {
                statsRequest();
                return HttpResponse.json(stats);
            }),
        );
        renderWithStore(<AdminDashboard />);
        expect(
            await screen.findByText("Admin access is required."),
        ).toBeTruthy();
        expect(statsRequest).not.toHaveBeenCalled();
    });

    it("shows a sign-in link for a guest", async () => {
        server.use(
            http.get(
                `${api}/users/me`,
                () => new HttpResponse(null, { status: 401 }),
            ),
        );
        renderWithStore(<SellerDashboard />);
        expect(
            await screen.findByRole("link", { name: "Sign in" }),
        ).toBeTruthy();
    });

    it("loads admin stats and explains that totals are not payment", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json({ ...user, isAdmin: true }),
            ),
            http.get(`${api}/admin/stats`, () => HttpResponse.json(stats)),
        );
        renderWithStore(<AdminDashboard />);
        expect(await screen.findByText("12.00")).toBeTruthy();
        expect(screen.getByText(/does not process payments/)).toBeTruthy();
    });

    it("cancels a pending order through the admin endpoint", async () => {
        const orderId = "00000000-0000-4000-8000-000000000010";
        let status = "pending";
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json({ ...user, isAdmin: true }),
            ),
            http.get(`${api}/admin/stats`, () => HttpResponse.json(stats)),
            http.get(`${api}/admin/orders`, () =>
                HttpResponse.json([
                    {
                        id: orderId,
                        userId: "buyer",
                        status,
                        totalAmount: "12.00",
                        customerEmail: user.email,
                        customerName: user.name,
                        createdAt: "2026-01-01",
                    },
                ]),
            ),
            http.patch(
                `${api}/admin/orders/${orderId}`,
                async ({ request }) => {
                    expect(await request.json()).toEqual({
                        status: "cancelled",
                    });
                    status = "cancelled";
                    return HttpResponse.json({});
                },
            ),
        );
        renderWithStore(<AdminDashboard />);
        const person = userEvent.setup();
        await person.click(
            await screen.findByRole("button", { name: "Orders" }),
        );
        await person.click(
            await screen.findByRole("button", { name: "Cancel order" }),
        );
        expect(await screen.findByText("Order cancelled.")).toBeTruthy();
        expect(
            (await screen.findByText(new RegExp(orderId))).textContent,
        ).toContain("cancelled");
        confirm.mockRestore();
    });
});

describe("seller CMS", () => {
    it("creates a store when no seller profile exists", async () => {
        let currentSeller: typeof seller | null = null;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/sellers/me`, () =>
                currentSeller
                    ? HttpResponse.json(currentSeller)
                    : new HttpResponse(null, { status: 404 }),
            ),
            http.post(`${api}/sellers`, async ({ request }) => {
                expect(await request.json()).toEqual({
                    storeName: "Buyer store",
                    description: null,
                });
                currentSeller = seller;
                return HttpResponse.json(seller, { status: 201 });
            }),
            http.get(`${api}/categories`, () => HttpResponse.json([])),
            http.get(`${api}/products`, () => HttpResponse.json([])),
        );
        renderWithStore(<SellerDashboard />);
        const person = userEvent.setup();
        await person.type(
            await screen.findByLabelText("Store name"),
            "Buyer store",
        );
        await person.click(screen.getByRole("button", { name: "Save store" }));
        expect(await screen.findByText("Store profile saved.")).toBeTruthy();
        expect(await screen.findByText("No products found.")).toBeTruthy();
    });

    it("edits a product through the seller route and refreshes the list", async () => {
        let product = makeProduct();
        const mutation = vi.fn<(body: unknown) => void>();
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/sellers/me`, () => HttpResponse.json(seller)),
            http.get(`${api}/categories`, () =>
                HttpResponse.json([
                    { id: product.categoryId, name: "Keyboards" },
                ]),
            ),
            http.get(`${api}/products`, ({ request }) => {
                expect(new URL(request.url).searchParams.get("sellerId")).toBe(
                    seller.id,
                );
                return HttpResponse.json([product]);
            }),
            http.get(`${api}/products/${product.id}/images`, () =>
                HttpResponse.json([]),
            ),
            http.patch(`${api}/products/${product.id}`, async ({ request }) => {
                const body = await request.json();
                mutation(body);
                product = { ...product, name: "Updated keyboard" };
                return HttpResponse.json(product);
            }),
        );
        renderWithStore(<SellerDashboard />);
        const person = userEvent.setup();
        const row = (await screen.findByText(/Mechanical Keyboard/)).closest(
            "li",
        );
        if (!row) throw new Error("Missing product row");
        await person.click(within(row).getByRole("button", { name: "Edit" }));
        const input = screen.getByLabelText("Name");
        await person.clear(input);
        await person.type(input, "Updated keyboard");
        await person.click(
            screen.getByRole("button", { name: "Save product" }),
        );
        expect(await screen.findByText("Product updated.")).toBeTruthy();
        expect(mutation).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Updated keyboard" }),
        );
        expect(await screen.findByText(/Updated keyboard —/)).toBeTruthy();
    });
});
