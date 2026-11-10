// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Footer from "./Footer";

afterEach(cleanup);

describe("Footer", () => {
    it("links to the catalog and profile", () => {
        render(<Footer />);
        const nav = screen.getByRole("navigation", { name: "Footer" });

        expect(nav.querySelector('a[href="/catalog"]')).not.toBeNull();
        expect(nav.querySelector('a[href="/profile"]')).not.toBeNull();
    });
});
