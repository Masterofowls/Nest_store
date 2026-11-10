// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuantitySelector from "./QuantitySelector";

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

    it("reports changes when the quantity is controlled by its parent", async () => {
        const onQuantityChange = vi.fn<(quantity: number) => void>();
        render(
            <QuantitySelector
                unitPrice={12}
                quantity={2}
                onQuantityChange={onQuantityChange}
            />,
        );

        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Increase" }));

        expect(onQuantityChange).toHaveBeenCalledWith(3);
        expect(screen.getByText("Quantity: 2")).not.toBeNull();
    });

    it("stops at the maximum quantity and rounds the total to cents", async () => {
        render(<QuantitySelector unitPrice={89.99} maxQuantity={3} />);
        const increase = screen.getByRole("button", { name: "Increase" });
        const user = userEvent.setup();

        await user.click(increase);
        await user.click(increase);

        expect(screen.getByText("Quantity: 3")).not.toBeNull();
        expect(screen.getByText("Total: 269.97")).not.toBeNull();
        expect(increase).toHaveProperty("disabled", true);
    });
});
