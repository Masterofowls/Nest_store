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
import { ApiError } from "../../../shared/api/response";
import { signOut } from "./signOut";

const api = "https://store.example.test/backend/";
const endpoint = `${api}api/auth/sign-out`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("signOut", () => {
    it("posts through the proxy without a body and returns no response data", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        let body: string | undefined;
        server.use(
            http.post(endpoint, async ({ request }) => {
                body = await request.text();
                return HttpResponse.json({ success: true });
            }),
        );

        await expect(signOut(api)).resolves.toBeUndefined();
        expect(body).toBe("");
        expect(fetchSpy).toHaveBeenCalledWith(new URL(endpoint), {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
        });
    });

    it.each([401, 403, 500])("reports HTTP status %i", async (status) => {
        server.use(
            http.post(endpoint, () =>
                HttpResponse.text("request failed", { status }),
            ),
        );

        await expect(signOut(api)).rejects.toBeInstanceOf(ApiError);
        await expect(signOut(api)).rejects.toMatchObject({
            status,
            message: `Sign out request failed (HTTP ${status})`,
        });
    });

    it("does not parse or return the successful response body", async () => {
        server.use(http.post(endpoint, () => HttpResponse.text("not JSON")));
        await expect(signOut(api)).resolves.toBeUndefined();
    });

    it("propagates network failures", async () => {
        server.use(http.post(endpoint, () => HttpResponse.error()));
        await expect(signOut(api)).rejects.toBeInstanceOf(TypeError);
    });

    it.each([
        "https://store.example.test/backend",
        "https://store.example.test/backend/?next=other",
        "ftp://store.example.test/",
    ])("rejects an invalid API base before making a request", async (base) => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(signOut(base)).rejects.toThrow("API base must");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects a malformed API URL before making a request", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(signOut("not-a-url")).rejects.toBeInstanceOf(TypeError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
