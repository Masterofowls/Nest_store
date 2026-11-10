// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import ViewHistory from "./ViewHistory";

const server = setupApiServer();

describe("ViewHistory", () => {
    it("links recently viewed products", async () => {
        const id = "00000000-0000-4000-8000-000000000001";
        server.use(
            http.get(`${api}/users/me/views`, () =>
                HttpResponse.json([
                    {
                        id,
                        productId: id,
                        productName: "Keyboard",
                        viewedAt: "2026-01-02T03:04:05.000Z",
                    },
                ]),
            ),
        );
        renderWithStore(<ViewHistory />);
        expect(
            (
                await screen.findByRole("link", { name: "Keyboard" })
            ).getAttribute("href"),
        ).toBe(`/products/${id}`);
    });
});
