import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("local API rewrite", () => {
    it("forwards the backend prefix to the configured origin", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("API_ORIGIN", "http://localhost:4000");
        if (!nextConfig.rewrites) {
            throw new Error("Next.js rewrites are not configured");
        }

        await expect(nextConfig.rewrites()).resolves.toEqual([
            {
                source: "/backend/:path*",
                destination: "http://localhost:4000/:path*",
            },
        ]);
    });

    it("reports when it uses the local development default", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("API_ORIGIN", undefined);
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        if (!nextConfig.rewrites) {
            throw new Error("Next.js rewrites are not configured");
        }

        await expect(nextConfig.rewrites()).resolves.toEqual([
            {
                source: "/backend/:path*",
                destination: "http://localhost:3000/:path*",
            },
        ]);
        expect(warning).toHaveBeenCalledWith(
            "API_ORIGIN is not set; using http://localhost:3000 for development.",
        );
    });

    it("accepts an HTTPS origin with a trailing slash", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("API_ORIGIN", "https://api.example.test/");
        if (!nextConfig.rewrites) {
            throw new Error("Next.js rewrites are not configured");
        }

        await expect(nextConfig.rewrites()).resolves.toEqual([
            {
                source: "/backend/:path*",
                destination: "https://api.example.test/:path*",
            },
        ]);
    });

    it.each([
        "",
        "not-a-url",
        "ftp://localhost:3000",
        "http://localhost:3000/api",
        "http://localhost:3000/?key=value",
        "http://localhost:3000/?",
        "http://localhost:3000/#fragment",
        "http://localhost:3000/#",
        "http://user:password@localhost:3000",
    ])("rejects an invalid API_ORIGIN: %s", async (origin) => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("API_ORIGIN", origin);
        if (!nextConfig.rewrites) {
            throw new Error("Next.js rewrites are not configured");
        }

        await expect(nextConfig.rewrites()).rejects.toThrow(
            "API_ORIGIN must be a valid HTTP or HTTPS origin.",
        );
    });

    it("does not point production at a local API", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("API_ORIGIN", "not-a-url");
        if (!nextConfig.rewrites) {
            throw new Error("Next.js rewrites are not configured");
        }

        await expect(nextConfig.rewrites()).resolves.toEqual([]);
    });
});
