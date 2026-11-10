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
import TileFavouriteToggle from "./TileFavouriteToggle";

const server = setupApiServer();
const product = makeProduct();
const favouriteId = "00000000-0000-4000-8000-000000000501";

describe("TileFavouriteToggle", () => {
    it("links a guest to sign in", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
        );
        renderWithStore(
            <TileFavouriteToggle
                productId={product.id}
                productName={product.name}
            />,
        );

        expect(
            (
                await screen.findByRole("link", {
                    name: `Sign in to save ${product.name}`,
                })
            ).getAttribute("href"),
        ).toBe("/login");
    });

    it("toggles the favourite and reports the pressed state", async () => {
        let saved = false;
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json({
                    id: "user-1",
                    name: "Buyer",
                    email: "buyer@example.test",
                    emailVerified: false,
                    image: null,
                }),
            ),
            http.get(`${api}/favourites`, () =>
                HttpResponse.json(
                    saved
                        ? [
                              {
                                  id: favouriteId,
                                  productId: product.id,
                                  productName: product.name,
                                  createdAt: "2026-11-10T00:00:00.000Z",
                              },
                          ]
                        : [],
                ),
            ),
            http.post(`${api}/favourites`, () => {
                saved = true;
                return HttpResponse.json(
                    {
                        id: favouriteId,
                        productId: product.id,
                        productName: product.name,
                        createdAt: "2026-11-10T00:00:00.000Z",
                    },
                    { status: 201 },
                );
            }),
            http.delete(`${api}/favourites/${favouriteId}`, () => {
                saved = false;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        const user = userEvent.setup();
        renderWithStore(
            <TileFavouriteToggle
                productId={product.id}
                productName={product.name}
            />,
        );

        const toggle = await screen.findByRole("button", {
            name: `Save ${product.name} to favourites`,
        });
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        await user.click(toggle);
        await screen.findByRole("button", { pressed: true });
        await user.click(screen.getByRole("button", { pressed: true }));
        expect(
            await screen.findByRole("button", { pressed: false }),
        ).not.toBeNull();
    });
});
