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
import { getCurrentUser } from "./get-current-user";

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

describe("getCurrentUser", () => {
    it("requests and validates the current user through the proxy path", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        let method: string | undefined;
        server.use(
            http.get(endpoint, ({ request }) => {
                method = request.method;
                return HttpResponse.json(user);
            }),
        );

        await expect(getCurrentUser(api)).resolves.toEqual(user);
        expect(method).toBe("GET");
        expect(fetchSpy).toHaveBeenCalledWith(new URL(endpoint), {
            cache: "no-store",
            credentials: "same-origin",
        });
    });

    it.each([401, 500])("reports HTTP status %i", async (status) => {
        server.use(
            http.get(endpoint, () => HttpResponse.text("not JSON", { status })),
        );

        await expect(getCurrentUser(api)).rejects.toBeInstanceOf(ApiError);
        await expect(getCurrentUser(api)).rejects.toMatchObject({
            status,
            message: `Current user request failed (HTTP ${status})`,
        });
    });

    it("rejects an invalid user and preserves the validation cause", async () => {
        server.use(
            http.get(endpoint, () =>
                HttpResponse.json({ ...user, emailVerified: "false" }),
            ),
        );

        await expect(getCurrentUser(api)).rejects.toThrow(
            expect.objectContaining({
                message: "Invalid current user response",
                cause: expect.any(ZodError),
            }),
        );
    });

    it("rejects malformed JSON", async () => {
        server.use(http.get(endpoint, () => HttpResponse.text("{")));
        await expect(getCurrentUser(api)).rejects.toBeInstanceOf(SyntaxError);
    });

    it("propagates a network failure", async () => {
        server.use(http.get(endpoint, () => HttpResponse.error()));
        await expect(getCurrentUser(api)).rejects.toBeInstanceOf(TypeError);
    });

    it("rejects an invalid base URL before making a request", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(getCurrentUser("not-a-url")).rejects.toBeInstanceOf(
            TypeError,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
