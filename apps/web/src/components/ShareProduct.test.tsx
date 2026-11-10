// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShareProduct from "./ShareProduct";

describe("ShareProduct", () => {
    it("shows an absolute link and copies it", async () => {
        const writeText = vi
            .fn<(text: string) => Promise<void>>()
            .mockResolvedValue();
        const originalClipboard = Object.getOwnPropertyDescriptor(
            navigator,
            "clipboard",
        );
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
        render(
            <ShareProduct
                productId="00000000-0000-4000-8000-000000000001"
                name="Keyboard"
            />,
        );
        expect(
            await screen.findByRole("img", { name: "QR code for Keyboard" }),
        ).not.toBeNull();
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe(
            `${window.location.origin}/products/00000000-0000-4000-8000-000000000001`,
        );
        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect((await screen.findByRole("status")).textContent).toBe(
            "Link copied",
        );
        expect(writeText).toHaveBeenCalledWith(link.getAttribute("href"));
        if (originalClipboard) {
            Object.defineProperty(navigator, "clipboard", originalClipboard);
        } else {
            Reflect.deleteProperty(navigator, "clipboard");
        }
    });
});
