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
import { signInAndGetCurrentUser } from "./signInAndGetCurrentUser";

const api = "https://store.example.test/backend/";
const signInEndpoint = `${api}api/auth/sign-in/email`;
const currentUserEndpoint = `${api}users/me`;
const email = "buyer@example.test";
const password = "test-password";
const user = {
    id: "user_123",
    name: "Morgan",
    email,
    emailVerified: false,
    image: null,
};
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("signInAndGetCurrentUser", () => {
    it("loads the current user after sign-in succeeds", async () => {
        const requests: string[] = [];
        server.use(
            http.post(signInEndpoint, () => {
                requests.push("sign-in");
                return HttpResponse.json({ token: "test-token" });
            }),
            http.get(currentUserEndpoint, () => {
                requests.push("current-user");
                return HttpResponse.json(user);
            }),
        );

        await expect(
            signInAndGetCurrentUser(api, email, password),
        ).resolves.toEqual(user);
        expect(requests).toEqual(["sign-in", "current-user"]);
    });

    it.each([401, 500])(
        "does not load the current user when sign-in returns %i",
        async (status) => {
            const fetchSpy = vi.spyOn(globalThis, "fetch");
            server.use(
                http.post(signInEndpoint, () =>
                    HttpResponse.text("sign-in failed", { status }),
                ),
            );

            await expect(
                signInAndGetCurrentUser(api, email, password),
            ).rejects.toMatchObject({
                status,
                message: `Sign in request failed (HTTP ${status})`,
            });
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        },
    );

    it("rejects invalid credentials without making a request", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        await expect(
            signInAndGetCurrentUser(api, "not-an-email", password),
        ).rejects.toBeInstanceOf(ZodError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("propagates a failure to load the session after sign-in", async () => {
        server.use(
            http.post(signInEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () =>
                HttpResponse.text("not signed in", { status: 401 }),
            ),
        );

        await expect(
            signInAndGetCurrentUser(api, email, password),
        ).rejects.toMatchObject({
            status: 401,
            message: "Current user request failed (HTTP 401)",
        });
    });

    it("propagates an invalid current-user response", async () => {
        server.use(
            http.post(signInEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () =>
                HttpResponse.json({ ...user, emailVerified: "false" }),
            ),
        );

        await expect(
            signInAndGetCurrentUser(api, email, password),
        ).rejects.toThrow(
            expect.objectContaining({
                message: "Invalid current user response",
                cause: expect.any(ZodError),
            }),
        );
    });

    it("propagates a sign-in network failure without loading the user", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        server.use(http.post(signInEndpoint, () => HttpResponse.error()));

        await expect(
            signInAndGetCurrentUser(api, email, password),
        ).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("propagates a current-user network failure after sign-in", async () => {
        server.use(
            http.post(signInEndpoint, () => HttpResponse.json({})),
            http.get(currentUserEndpoint, () => HttpResponse.error()),
        );

        await expect(
            signInAndGetCurrentUser(api, email, password),
        ).rejects.toBeInstanceOf(TypeError);
    });
});
