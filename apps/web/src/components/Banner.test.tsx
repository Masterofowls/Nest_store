// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Banner from "./Banner";

afterEach(cleanup);

describe("Banner", () => {
    it("renders a labelled section with its action link", () => {
        render(
            <Banner
                title="Filter by category"
                description="Narrow products by category."
                href="/catalog"
                actionLabel="Open the catalog"
            />,
        );

        expect(
            screen.getByRole("region", { name: "Filter by category" }),
        ).not.toBeNull();
        expect(screen.getByText("Narrow products by category.")).not.toBeNull();
        expect(
            screen
                .getByRole("link", { name: "Open the catalog" })
                .getAttribute("href"),
        ).toBe("/catalog");
    });
});
