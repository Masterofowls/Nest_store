// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Signup from "./Signup";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));

const server = setupApiServer();

async function submit(name: string, email: string, password: string) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), name);
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("Signup", () => {
    it("rejects a short password without calling the API", async () => {
        const signUp = vi.fn<() => void>();
        server.use(
            http.post(`${api}/api/auth/sign-up/email`, () => {
                signUp();
                return HttpResponse.json({});
            }),
        );
        renderWithStore(<Signup />);

        await submit("Daniil", "daniil@example.test", "short");

        expect(screen.getByRole("alert").textContent).toBe(
            "Enter your name, a valid email, and a password of 8 to 128 characters.",
        );
        expect(signUp).not.toHaveBeenCalled();
    });

    it("creates the account and opens the profile", async () => {
        let body: unknown;
        server.use(
            http.post(`${api}/api/auth/sign-up/email`, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ token: null });
            }),
        );
        renderWithStore(<Signup />);

        await submit(" Daniil ", "daniil@example.test", "secret-password");

        await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
        expect(body).toEqual({
            name: "Daniil",
            email: "daniil@example.test",
            password: "secret-password",
        });
    });

    it("explains that the email is taken", async () => {
        server.use(
            http.post(`${api}/api/auth/sign-up/email`, () =>
                HttpResponse.json({}, { status: 422 }),
            ),
        );
        renderWithStore(<Signup />);

        await submit("Daniil", "daniil@example.test", "secret-password");

        expect(
            await screen.findByText(
                "An account with this email already exists.",
            ),
        ).not.toBeNull();
        expect(push).not.toHaveBeenCalled();
    });
});
