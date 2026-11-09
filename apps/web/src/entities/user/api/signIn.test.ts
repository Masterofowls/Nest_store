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
import { signIn } from "./signIn";

const api = "https://store.example.test/backend/";
const endpoint = `${api}api/auth/sign-in/email`;
const email = "buyer@example.test";
const password = "test-password";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("signIn", () => {
    it("posts credentials through the proxy and returns no response data", async () => {
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

        await expect(signIn(api, email, password)).resolves.toBeUndefined();
        expect(body).toEqual({ email, password });
        expect(fetchSpy).toHaveBeenCalledWith(new URL(endpoint), {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            credentials: "same-origin",
        });
    });

    it.each([401, 403, 500])("reports HTTP status %i", async (status) => {
        server.use(
            http.post(endpoint, () =>
                HttpResponse.text("request failed", { status }),
            ),
        );

        await expect(signIn(api, email, password)).rejects.toBeInstanceOf(
            ApiError,
        );
        await expect(signIn(api, email, password)).rejects.toMatchObject({
            status,
            message: `Sign in request failed (HTTP ${status})`,
        });
    });

    it("does not parse or return the successful response body", async () => {
        server.use(http.post(endpoint, () => HttpResponse.text("not JSON")));
        await expect(signIn(api, email, password)).resolves.toBeUndefined();
    });

    it("propagates network failures", async () => {
        server.use(http.post(endpoint, () => HttpResponse.error()));
        await expect(signIn(api, email, password)).rejects.toBeInstanceOf(
            TypeError,
        );
    });

    it.each([
        ["invalid email", "not-an-email", password, "email"],
        ["long password", email, "a".repeat(129), "password"],
    ])(
        "rejects %s before making a request",
        async (_description, inputEmail, inputPassword, field) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            const result = signIn(api, inputEmail, inputPassword);
            await expect(result).rejects.toBeInstanceOf(ZodError);
            await expect(result).rejects.toMatchObject({
                issues: expect.arrayContaining([
                    expect.objectContaining({ path: [field] }),
                ]),
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        },
    );

    it.each(["short", " secret "])(
        "sends the password unchanged",
        async (inputPassword) => {
            let body: unknown;
            server.use(
                http.post(endpoint, async ({ request }) => {
                    body = await request.json();
                    return HttpResponse.json({ token: "test-token" });
                }),
            );

            await expect(
                signIn(api, email, inputPassword),
            ).resolves.toBeUndefined();
            expect(body).toEqual({ email, password: inputPassword });
        },
    );

    it.each([
        "https://store.example.test/backend",
        "https://store.example.test/backend/?next=other",
        "ftp://store.example.test/",
    ])(
        "rejects an invalid API base before sending credentials",
        async (base) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            await expect(signIn(base, email, password)).rejects.toThrow(
                "API base must",
            );
            expect(fetchSpy).not.toHaveBeenCalled();
        },
    );

    it("rejects a malformed API URL before sending credentials", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(
            signIn("not-a-url", email, password),
        ).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
