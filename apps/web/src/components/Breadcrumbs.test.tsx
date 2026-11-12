// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Breadcrumbs, { categoryCrumbs } from "./Breadcrumbs";

const audio = { id: "00000000-0000-4000-8000-000000000103", name: "Audio" };
const headphones = {
    id: "00000000-0000-4000-8000-000000000104",
    name: "Headphones",
    parentId: audio.id,
};

afterEach(cleanup);

describe("Breadcrumbs", () => {
    it("builds the category path from the top level down", () => {
        expect(
            categoryCrumbs([audio, headphones], headphones.id).map(
                (crumb) => crumb.label,
            ),
        ).toEqual(["Home", "Catalog", "Audio", "Headphones"]);
    });

    it("stops at home and catalog for an unknown category", () => {
        expect(
            categoryCrumbs([audio], "missing").map((crumb) => crumb.label),
        ).toEqual(["Home", "Catalog"]);
    });

    it("does not loop on a category cycle", () => {
        const first = { id: "a", name: "A", parentId: "b" };
        const second = { id: "b", name: "B", parentId: "a" };
        expect(categoryCrumbs([first, second], "a")).toHaveLength(4);
    });

    it("marks the current page and links the rest", () => {
        render(
            <Breadcrumbs
                crumbs={categoryCrumbs([audio], audio.id)}
                current="Studio Headphones"
            />,
        );
        expect(
            screen.getByRole("link", { name: "Audio" }).getAttribute("href"),
        ).toBe(`/catalog?category=${audio.id}`);
        expect(
            screen.getByText("Studio Headphones").getAttribute("aria-current"),
        ).toBe("page");
    });
});
