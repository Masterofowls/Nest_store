// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import QuantitySelector from "./QuantitySelector";

vi.mock("@/components/ProductList", () => ({
    default: function MockProductList() {
        return <h1>Products</h1>;
    },
}));

afterEach(cleanup);

describe("QuantitySelector", () => {
    it("starts at one and disables decreasing", () => {
        render(<QuantitySelector unitPrice={12} />);

        expect(screen.getByText("Quantity: 1")).not.toBeNull();
        expect(screen.getByText("Unit price: 12")).not.toBeNull();
        expect(screen.getByText("Total: 12")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Decrease" })).toHaveProperty(
            "disabled",
            true,
        );
        expect(
            screen
                .getByRole("button", { name: "Increase" })
                .getAttribute("type"),
        ).toBe("button");
        expect(
            screen
                .getByRole("button", { name: "Decrease" })
                .getAttribute("type"),
        ).toBe("button");
    });

    it("increases and decreases without going below one", async () => {
        const user = userEvent.setup();
        render(<QuantitySelector unitPrice={12} />);
        const increase = screen.getByRole("button", { name: "Increase" });
        const decrease = screen.getByRole("button", { name: "Decrease" });

        await user.click(increase);
        await user.click(increase);
        await user.click(increase);
        expect(screen.getByText("Quantity: 4")).not.toBeNull();
        expect(screen.getByText("Total: 48")).not.toBeNull();
        expect(decrease).toHaveProperty("disabled", false);

        await user.click(decrease);
        await user.click(decrease);
        await user.click(decrease);
        expect(screen.getByText("Quantity: 1")).not.toBeNull();
        expect(screen.getByText("Total: 12")).not.toBeNull();
        expect(decrease).toHaveProperty("disabled", true);

        await user.click(decrease);
        expect(screen.getByText("Quantity: 1")).not.toBeNull();
    });

    it("is rendered alongside the existing home page content", () => {
        render(<Home />);

        expect(screen.getByText("Hello world!")).not.toBeNull();
        expect(screen.getByText("Quantity: 1")).not.toBeNull();
        expect(
            screen.getByRole("heading", { name: "Products" }),
        ).not.toBeNull();
    });
});
