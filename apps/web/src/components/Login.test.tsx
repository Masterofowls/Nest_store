// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Login from "./Login";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));

const server = setupApiServer();

async function submit(email: string, password: string) {
    const user = userEvent.setup();
    if (email) {
        await user.type(screen.getByLabelText("Email"), email);
    }
    if (password) {
        await user.type(screen.getByLabelText("Password"), password);
    }
    await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Login", () => {
    it("rejects invalid input without calling the API", async () => {
        const signIn = vi.fn<() => void>();
        server.use(
            http.post(`${api}/api/auth/sign-in/email`, () => {
                signIn();
                return HttpResponse.json({});
            }),
        );
        renderWithStore(<Login />);

        await submit("not-an-email", "secret-password");

        expect(
            screen.getByText("Enter a valid email and your password."),
        ).not.toBeNull();
        expect(signIn).not.toHaveBeenCalled();
    });

    it("signs in and opens the profile", async () => {
        let body: unknown;
        server.use(
            http.post(`${api}/api/auth/sign-in/email`, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ redirect: false });
            }),
        );
        renderWithStore(<Login />);

        await submit(" daniil@example.test ", "secret-password");

        await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
        expect(body).toEqual({
            email: "daniil@example.test",
            password: "secret-password",
        });
    });

    it("explains rejected credentials", async () => {
        server.use(
            http.post(`${api}/api/auth/sign-in/email`, () =>
                HttpResponse.json({}, { status: 401 }),
            ),
        );
        renderWithStore(<Login />);

        await submit("daniil@example.test", "wrong-password");

        expect(
            await screen.findByText("Email or password is incorrect."),
        ).not.toBeNull();
        expect(push).not.toHaveBeenCalled();
    });
});
