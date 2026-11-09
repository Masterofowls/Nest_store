import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    cacheComponents: true,
    partialPrefetching: true,
    async rewrites() {
        if (process.env.NODE_ENV !== "development") {
            return [];
        }

        const origin = process.env.API_ORIGIN ?? "http://localhost:3000";
        if (process.env.API_ORIGIN === undefined) {
            console.warn(
                "API_ORIGIN is not set; using http://localhost:3000 for development.",
            );
        }

        if (!URL.canParse(origin)) {
            throw new Error("API_ORIGIN must be a valid HTTP or HTTPS origin.");
        }

        const url = new URL(origin);
        if (
            (url.protocol !== "http:" && url.protocol !== "https:") ||
            url.href !== `${url.origin}/`
        ) {
            throw new Error("API_ORIGIN must be a valid HTTP or HTTPS origin.");
        }

        return [
            {
                source: "/backend/:path*",
                destination: `${url.origin}/:path*`,
            },
        ];
    },
};

export default nextConfig;
