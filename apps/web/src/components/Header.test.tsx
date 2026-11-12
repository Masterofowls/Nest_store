// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import Header from "./Header";

const push = vi.fn<(href: string) => void>();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
        // Sign-up is reached from the sign-in page, not a second header row.
        expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
        expect(
            screen
                .getByRole("button", { name: "Catalog" })
                .getAttribute("aria-expanded"),
        ).toBe("false");
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

    it("opens the catalog menu with nested categories and closes on Escape", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
            http.get(`${api}/categories`, () =>
                HttpResponse.json([
                    {
                        id: "00000000-0000-4000-8000-000000000201",
                        name: "Electronics",
                        parentId: null,
                    },
                    {
                        id: "00000000-0000-4000-8000-000000000202",
                        name: "Headphones",
                        parentId: "00000000-0000-4000-8000-000000000201",
                    },
                ]),
            ),
        );
        const userActions = userEvent.setup();
        renderWithStore(<Header />);

        const menuButton = screen.getByRole("button", { name: "Catalog" });
        await userActions.click(menuButton);
        expect(menuButton.getAttribute("aria-expanded")).toBe("true");
        const headphones = (
            await screen.findAllByRole("link", { name: "Headphones" })
        )[0];
        expect(headphones?.getAttribute("href")).toBe(
            "/catalog?category=00000000-0000-4000-8000-000000000202",
        );
        expect(
            screen
                .getByRole("link", { name: "All products" })
                .getAttribute("href"),
        ).toBe("/catalog");

        await userActions.keyboard("{Escape}");
        expect(menuButton.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(menuButton);
    });

    it("suggests products while typing and opens one with the keyboard", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
            http.get(`${api}/products`, ({ request }) =>
                HttpResponse.json(
                    new URL(request.url).searchParams.get("search") === "key"
                        ? [makeProduct({ name: "Mechanical Keyboard" })]
                        : [],
                ),
            ),
        );
        const userActions = userEvent.setup();
        renderWithStore(<Header />);

        const combobox = screen.getByRole("combobox", {
            name: "Search the store",
        });
        await userActions.type(combobox, "key");
        expect(
            await screen.findByRole("option", { name: "Mechanical Keyboard" }),
        ).not.toBeNull();
        expect(combobox.getAttribute("aria-expanded")).toBe("true");

        await userActions.keyboard("{ArrowDown}{Enter}");
        expect(push).toHaveBeenCalledWith(
            "/products/00000000-0000-4000-8000-000000000001",
        );
    });

    it("shows cart and favourite counts on the shortcuts", async () => {
        const product = makeProduct();
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.get(`${api}/cart`, () =>
                HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000301",
                    items: [
                        {
                            id: "00000000-0000-4000-8000-000000000302",
                            productId: product.id,
                            quantity: 3,
                            product,
                        },
                    ],
                }),
            ),
            http.get(`${api}/favourites`, () =>
                HttpResponse.json([
                    {
                        id: "00000000-0000-4000-8000-000000000303",
                        productId: product.id,
                        productName: product.name,
                        createdAt: "2026-11-10T00:00:00.000Z",
                    },
                ]),
            ),
        );
        renderWithStore(<Header />);

        expect(
            await screen.findByRole("link", { name: "Cart 3 items" }),
        ).not.toBeNull();
        expect(
            await screen.findByRole("link", { name: "Favourites 1 item" }),
        ).not.toBeNull();
    });
});
