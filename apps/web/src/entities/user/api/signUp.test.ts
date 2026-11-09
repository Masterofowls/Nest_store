import { HttpResponse, http } from "msw/http";
import { setupServer } from "msw/node";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { ZodError } from "zod";
import { ApiError } from "../../../shared/api/response";
import { signUp } from "./signUp";

const api = "https://store.example.test/backend/";
const endpoint = `${api}api/auth/sign-up/email`;
const name = "Test buyer";
const email = "buyer@example.test";
const password = "test-password";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("signUp", () => {
    it("posts registration details through the proxy and returns no response data", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        let body: unknown;
        server.use(
            http.post(endpoint, async ({ request }) => {
                body = await request.json();
                expect(request.headers.get("content-type")).toBe(
                    "application/json",
                );
                return HttpResponse.json({ token: "test-token" });
            }),
        );

        await expect(
            signUp(api, name, email, password),
        ).resolves.toBeUndefined();
        expect(body).toEqual({ name, email, password });
        expect(fetchSpy).toHaveBeenCalledWith(new URL(endpoint), {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
            credentials: "same-origin",
        });
    });

    it.each([400, 403, 409, 422, 500])(
        "reports HTTP status %i",
        async (status) => {
            server.use(
                http.post(endpoint, () =>
                    HttpResponse.text("request failed", { status }),
                ),
            );

            await expect(
                signUp(api, name, email, password),
            ).rejects.toBeInstanceOf(ApiError);
            await expect(
                signUp(api, name, email, password),
            ).rejects.toMatchObject({
                status,
                message: `Sign up request failed (HTTP ${status})`,
            });
        },
    );

    it("does not parse or return the successful response body", async () => {
        server.use(http.post(endpoint, () => HttpResponse.text("not JSON")));
        await expect(
            signUp(api, name, email, password),
        ).resolves.toBeUndefined();
    });

    it("propagates network failures", async () => {
        server.use(http.post(endpoint, () => HttpResponse.error()));
        await expect(signUp(api, name, email, password)).rejects.toBeInstanceOf(
            TypeError,
        );
    });

    it.each([
        ["invalid email", "not-an-email", password, "email"],
        ["short password", email, "a".repeat(7), "password"],
        ["long password", email, "a".repeat(129), "password"],
    ])(
        "rejects %s before making a request",
        async (_description, inputEmail, inputPassword, field) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            const result = signUp(api, name, inputEmail, inputPassword);
            await expect(result).rejects.toBeInstanceOf(ZodError);
            await expect(result).rejects.toMatchObject({
                issues: expect.arrayContaining([
                    expect.objectContaining({ path: [field] }),
                ]),
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        },
    );

    it("preserves password whitespace in the request", async () => {
        const inputPassword = " secret ";
        let body: unknown;
        server.use(
            http.post(endpoint, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({ token: "test-token" });
            }),
        );

        await expect(
            signUp(api, name, email, inputPassword),
        ).resolves.toBeUndefined();
        expect(body).toEqual({ name, email, password: inputPassword });
    });

    it.each([
        "https://store.example.test/backend",
        "https://store.example.test/backend/?next=other",
        "ftp://store.example.test/",
    ])(
        "rejects an invalid API base before sending credentials",
        async (base) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            await expect(signUp(base, name, email, password)).rejects.toThrow(
                "API base must",
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        },
    );

    it("rejects a malformed API URL before sending credentials", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(
            signUp("not-a-url", name, email, password),
        ).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
