import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseProductList } from "./parse-product-list";

const product = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Keyboard",
    description: null,
    sellerId: "00000000-0000-4000-8000-000000000002",
    categoryId: "00000000-0000-4000-8000-000000000003",
    stockQuantity: 2,
    discountPercent: 0,
    price: "29.99",
};

describe("parseProductList", () => {
    it("returns an empty list", () => {
        expect(parseProductList([])).toEqual([]);
    });

    it("returns validated products rather than a safeParse wrapper", () => {
        expect(parseProductList([product])).toEqual([product]);
    });

    it.each([null, {}, "invalid"])("rejects a non-list response", (value) => {
        expect(() => parseProductList(value)).toThrow(
            "Invalid product list response",
        );
    });

    it("preserves validation details as the error cause", () => {
        expect(() => parseProductList([{ ...product, price: -1 }])).toThrow(
            expect.objectContaining({
                message: "Invalid product list response",
                cause: expect.any(ZodError),
            }),
        );
    });
});
