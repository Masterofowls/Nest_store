// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeProduct } from "@/test/api-server";
import Card from "./Card";

afterEach(cleanup);

describe("Card", () => {
    it("links to the product page and shows price, discount and stock", () => {
        render(<Card product={makeProduct()} />);

        expect(
            screen
                .getByRole("link", { name: "Mechanical Keyboard" })
                .getAttribute("href"),
        ).toBe("/products/00000000-0000-4000-8000-000000000001");
        expect(screen.getByText("$80.99")).not.toBeNull();
        expect(screen.getByText("$89.99")).not.toBeNull();
        expect(screen.getByText("−10%")).not.toBeNull();
        expect(screen.getByText("24 in stock")).not.toBeNull();
    });

    it("hides a zero discount and marks an empty stock", () => {
        render(
            <Card
                product={makeProduct({ discountPercent: 0, stockQuantity: 0 })}
            />,
        );

        expect(screen.getByText("$89.99")).not.toBeNull();
        expect(screen.queryByText(/%/)).toBeNull();
        expect(screen.getByText("Out of stock")).not.toBeNull();
    });
});
