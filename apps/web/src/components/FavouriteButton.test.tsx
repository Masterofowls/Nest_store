// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import FavouriteButton from "./FavouriteButton";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const id = "00000000-0000-4000-8000-000000000001";

describe("FavouriteButton", () => {
    it("adds and removes a product from favourites", async () => {
        let saved = false;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/favourites`, () =>
                HttpResponse.json(
                    saved
                        ? [
                              {
                                  id,
                                  productId: id,
                                  productName: "Keyboard",
                                  createdAt: "2026-01-02T03:04:05.000Z",
                              },
                          ]
                        : [],
                ),
            ),
            http.post(`${api}/favourites`, () => {
                saved = true;
                return HttpResponse.json({
                    id,
                    productId: id,
                    productName: "Keyboard",
                    createdAt: "2026-01-02T03:04:05.000Z",
                });
            }),
            http.delete(`${api}/favourites/${id}`, () => {
                saved = false;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        renderWithStore(<FavouriteButton productId={id} />);
        const events = userEvent.setup();
        await events.click(
            await screen.findByRole("button", { name: "Add to favourites" }),
        );
        await events.click(
            await screen.findByRole("button", {
                name: "Remove from favourites",
            }),
        );
        expect(
            await screen.findByRole("button", { name: "Add to favourites" }),
        ).not.toBeNull();
    });
});
