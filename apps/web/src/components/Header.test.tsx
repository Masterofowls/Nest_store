// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Header from "./Header";

const server = setupApiServer();
const user = {
    id: "user-1",
    name: "Daniil",
    email: "daniil@example.test",
    emailVerified: false,
    image: null,
};

describe("Header", () => {
    it("shows sign-in links to a guest", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
        );
        renderWithStore(<Header />);

        expect(
            (await screen.findByRole("link", { name: "Sign in" })).getAttribute(
                "href",
            ),
        ).toBe("/login");
        expect(
            screen.getByRole("link", { name: "Sign up" }).getAttribute("href"),
        ).toBe("/signup");
        expect(
            screen.getByRole("link", { name: "Catalog" }).getAttribute("href"),
        ).toBe("/catalog");
    });

    it("signs out a signed-in user and refreshes the session", async () => {
        let signedIn = true;
        server.use(
            http.get(`${api}/users/me`, () =>
                signedIn
                    ? HttpResponse.json(user)
                    : HttpResponse.json(null, { status: 401 }),
            ),
            http.post(`${api}/api/auth/sign-out`, () => {
                signedIn = false;
                return HttpResponse.json({ success: true });
            }),
        );
        renderWithStore(<Header />);

        expect(
            (await screen.findByRole("link", { name: "Daniil" })).getAttribute(
                "href",
            ),
        ).toBe("/profile");
        expect(
            screen.getByRole("link", { name: "Cart" }).getAttribute("href"),
        ).toBe("/cart");
        expect(
            screen
                .getByRole("link", { name: "Favourites" })
                .getAttribute("href"),
        ).toBe("/favourites");
        expect(
            screen.getByRole("link", { name: "Orders" }).getAttribute("href"),
        ).toBe("/orders");

        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Sign out" }));

        expect(
            await screen.findByRole("link", { name: "Sign in" }),
        ).not.toBeNull();
        expect(screen.queryByRole("link", { name: "Daniil" })).toBeNull();
    });

    it("reports a failed session check", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 500 }),
            ),
        );
        renderWithStore(<Header />);

        expect(
            await screen.findByText("Couldn't check your session."),
        ).not.toBeNull();
    });
});
