// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Search from "./Search";

afterEach(cleanup);

describe("Search", () => {
    it("submits a trimmed product search", async () => {
        const onSearch = vi.fn<(search: string) => void>();
        const user = userEvent.setup();
        render(<Search onSearch={onSearch} />);

        await user.type(
            screen.getByRole("searchbox", { name: "Search products" }),
            "  keyboard  ",
        );
        await user.click(screen.getByRole("button", { name: "Search" }));

        expect(onSearch).toHaveBeenCalledWith("keyboard");
    });

    it("submits an empty value to clear the active search", async () => {
        const onSearch = vi.fn<(search: string) => void>();
        const user = userEvent.setup();
        render(<Search onSearch={onSearch} />);

        await user.click(screen.getByRole("button", { name: "Search" }));

        expect(onSearch).toHaveBeenCalledWith("");
    });
});
