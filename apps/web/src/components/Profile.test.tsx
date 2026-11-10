// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Profile from "./Profile";

const server = setupApiServer();

describe("Profile", () => {
    it("shows the signed-in user's details", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json({
                    id: "user-1",
                    name: "Daniil",
                    email: "daniil@example.test",
                    emailVerified: true,
                    image: null,
                }),
            ),
            http.get(`${api}/users/me/views`, () => HttpResponse.json([])),
        );
        renderWithStore(<Profile />);

        expect(await screen.findByText("daniil@example.test")).not.toBeNull();
        expect(screen.getByText("Verified")).not.toBeNull();
    });

    it("asks a guest to sign in", async () => {
        server.use(
            http.get(`${api}/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
        );
        renderWithStore(<Profile />);

        expect(
            (await screen.findByRole("link", { name: "Sign in" })).getAttribute(
                "href",
            ),
        ).toBe("/login");
    });

    it("allows retrying a failed profile request", async () => {
        let shouldFail = true;
        server.use(
            http.get(`${api}/users/me`, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return HttpResponse.json(null, { status: 500 });
                }
                return HttpResponse.json(null, { status: 401 });
            }),
        );
        renderWithStore(<Profile />);

        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Retry" }));

        expect(
            await screen.findByRole("link", { name: "Sign in" }),
        ).not.toBeNull();
    });
});
