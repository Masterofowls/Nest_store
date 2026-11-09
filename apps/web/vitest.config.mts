import { defineConfig } from "vitest/config";

export default defineConfig({
    root: import.meta.dirname,
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: "node",
        globals: false,
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.{test,spec}.{ts,tsx}",
                "src/**/__tests__/**",
                "src/**/*.d.ts",
            ],
            reportsDirectory: "./coverage",
            reporter: ["text", "html", "json-summary"],
        },
    },
});
