// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Favourites from "./Favourites";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};
const id = "00000000-0000-4000-8000-000000000001";

describe("Favourites", () => {
    it("lists products and removes a favourite", async () => {
        let hasFavourite = true;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/favourites`, () =>
                HttpResponse.json(
                    hasFavourite
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
            http.delete(`${api}/favourites/${id}`, () => {
                hasFavourite = false;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        renderWithStore(<Favourites />);
        expect(
            await screen.findByRole("link", { name: "Keyboard" }),
        ).not.toBeNull();
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Remove" }));
        expect(
            await screen.findByText("You haven't saved any favourites."),
        ).not.toBeNull();
    });
});
