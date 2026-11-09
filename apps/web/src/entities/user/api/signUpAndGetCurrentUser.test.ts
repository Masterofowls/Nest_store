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
import { signUpAndGetCurrentUser } from "./signUpAndGetCurrentUser";

const api = "https://store.example.test/backend/";
const signUpEndpoint = `${api}api/auth/sign-up/email`;
const currentUserEndpoint = `${api}users/me`;
const name = "Morgan";
const email = "buyer@example.test";
const password = "test-password";
const user = {
    id: "user_123",
    name,
    email,
    emailVerified: false,
    image: null,
};
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("signUpAndGetCurrentUser", () => {
    it("loads the current user after sign-up succeeds", async () => {
        const requests: string[] = [];
        server.use(
            http.post(signUpEndpoint, () => {
                requests.push("sign-up");
                return HttpResponse.json({ token: "test-token" });
            }),
            http.get(currentUserEndpoint, () => {
                requests.push("current-user");
                return HttpResponse.json(user);
            }),
        );

        await expect(
            signUpAndGetCurrentUser(api, name, email, password),
        ).resolves.toEqual(user);
        expect(requests).toEqual(["sign-up", "current-user"]);
    });

    it.each([400, 409, 500])(
        "does not load the current user when sign-up returns %i",
        async (status) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            server.use(
                http.post(signUpEndpoint, () =>
                    HttpResponse.text("sign-up failed", { status }),
                ),
            );

            await expect(
                signUpAndGetCurrentUser(api, name, email, password),
            ).rejects.toMatchObject({
                status,
                message: `Sign up request failed (HTTP ${status})`,
            });
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        },
    );

    it("rejects invalid input without making a request", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        await expect(
            signUpAndGetCurrentUser(api, name, "not-an-email", password),
        ).rejects.toBeInstanceOf(ZodError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("propagates failure to load the session after sign-up", async () => {
        server.use(
            http.post(signUpEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () =>
                HttpResponse.text("not signed in", { status: 401 }),
            ),
        );

        await expect(
            signUpAndGetCurrentUser(api, name, email, password),
        ).rejects.toMatchObject({
            status: 401,
            message: "Current user request failed (HTTP 401)",
        });
    });

    it("propagates an invalid current-user response", async () => {
        server.use(
            http.post(signUpEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () =>
                HttpResponse.json({ ...user, emailVerified: "false" }),
            ),
        );

        await expect(
            signUpAndGetCurrentUser(api, name, email, password),
        ).rejects.toThrow(
            expect.objectContaining({
                message: "Invalid current user response",
                cause: expect.any(ZodError),
            }),
        );
    });

    it("propagates a sign-up network failure without loading the user", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        server.use(http.post(signUpEndpoint, () => HttpResponse.error()));

        await expect(
            signUpAndGetCurrentUser(api, name, email, password),
        ).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("propagates a current-user network failure after sign-up", async () => {
        server.use(
            http.post(signUpEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () => HttpResponse.error()),
        );

        await expect(
            signUpAndGetCurrentUser(api, name, email, password),
        ).rejects.toBeInstanceOf(TypeError);
    });
});
