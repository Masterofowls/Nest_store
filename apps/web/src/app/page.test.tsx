// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/components/Dashboard", () => ({
    default: function MockDashboard() {
        return <h1>Dashboard</h1>;
    },
}));
vi.mock("@/features/management/ui/PublicBanners", () => ({
    default: function MockPublicBanners() {
        return null;
    },
}));

afterEach(cleanup);

describe("Home page", () => {
    it("renders the dashboard without a banner that repeats the catalog link", () => {
        render(<Home />);

        expect(
            screen.getByRole("heading", { level: 1, name: "Dashboard" }),
        ).not.toBeNull();
        expect(
            screen.queryByRole("link", { name: "Open the catalog" }),
        ).toBeNull();
    });
});
