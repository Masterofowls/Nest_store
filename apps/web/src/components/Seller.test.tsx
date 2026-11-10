// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Seller from "./Seller";

const server = setupApiServer();
const sellerId = "00000000-0000-4000-8000-000000000002";
const product = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Keyboard",
    description: null,
    sellerId,
    categoryId: "00000000-0000-4000-8000-000000000003",
    stockQuantity: 4,
    discountPercent: 0,
    price: "12.50",
};

describe("Seller", () => {
    it("shows seller details and their products", async () => {
        server.use(
            http.get(`${api}/sellers/${sellerId}`, () =>
                HttpResponse.json({
                    id: sellerId,
                    storeName: "Key Shop",
                    description: "Mechanical keyboards",
                    createdAt: "2026-01-02T03:04:05.000Z",
                    updatedAt: "2026-01-02T03:04:05.000Z",
                }),
            ),
            http.get(`${api}/products`, ({ request }) => {
                expect(new URL(request.url).searchParams.get("sellerId")).toBe(
                    sellerId,
                );
                return HttpResponse.json([product]);
            }),
        );
        renderWithStore(<Seller sellerId={sellerId} />);
        expect(
            await screen.findByRole("heading", { name: "Key Shop" }),
        ).not.toBeNull();
        expect(
            await screen.findByRole("link", { name: "Keyboard" }),
        ).not.toBeNull();
    });
});
