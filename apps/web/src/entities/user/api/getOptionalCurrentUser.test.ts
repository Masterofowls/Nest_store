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
import { getOptionalCurrentUser } from "./getOptionalCurrentUser";

const api = "https://store.example.test/backend/";
const endpoint = `${api}users/me`;
const user = {
    id: "user_123",
    name: "Morgan",
    email: "buyer@example.test",
    emailVerified: false,
    image: null,
};
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getOptionalCurrentUser", () => {
    it("returns the validated current user", async () => {
        server.use(http.get(endpoint, () => HttpResponse.json(user)));
        await expect(getOptionalCurrentUser(api)).resolves.toEqual(user);
    });

    it("returns null for a missing or invalid session", async () => {
        server.use(
            http.get(endpoint, () =>
                HttpResponse.text("not signed in", { status: 401 }),
            ),
        );
        await expect(getOptionalCurrentUser(api)).resolves.toBeNull();
    });

    it.each([403, 404, 500])("propagates HTTP %i", async (status) => {
        server.use(
            http.get(endpoint, () => HttpResponse.text("failed", { status })),
        );
        const result = getOptionalCurrentUser(api);
        await expect(result).rejects.toBeInstanceOf(ApiError);
        await expect(result).rejects.toMatchObject({
            status,
            message: `Current user request failed (HTTP ${status})`,
        });
    });

    it("preserves the cause of an invalid response", async () => {
        server.use(
            http.get(endpoint, () =>
                HttpResponse.json({ ...user, emailVerified: "false" }),
            ),
        );
        await expect(getOptionalCurrentUser(api)).rejects.toThrow(
            expect.objectContaining({
                message: "Invalid current user response",
                cause: expect.any(ZodError),
            }),
        );
    });

    it("propagates malformed JSON", async () => {
        server.use(http.get(endpoint, () => HttpResponse.text("{")));
        await expect(getOptionalCurrentUser(api)).rejects.toBeInstanceOf(
            SyntaxError,
        );
    });

    it("propagates network failures", async () => {
        server.use(http.get(endpoint, () => HttpResponse.error()));
        await expect(getOptionalCurrentUser(api)).rejects.toBeInstanceOf(
            TypeError,
        );
    });

    it("rejects an invalid API base without making a request", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(
            getOptionalCurrentUser("not-a-url"),
        ).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
