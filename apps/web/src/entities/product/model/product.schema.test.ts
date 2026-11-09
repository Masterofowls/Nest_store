import { describe, expect, it } from "vitest";
import { productListSchema, productSchema } from "./product.schema";

const product = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Keyboard",
    description: null,
    sellerId: "00000000-0000-4000-8000-000000000002",
    categoryId: "00000000-0000-4000-8000-000000000003",
    stockQuantity: 0,
    discountPercent: 0,
    price: "29.99",
};

describe("productSchema", () => {
    it("accepts a product with nullable description", () => {
        expect(productSchema.safeParse(product).success).toBe(true);
    });

    describe("productListSchema", () => {
        it("accepts an empty list", () => {
            expect(productListSchema.parse([])).toEqual([]);
        });

        it("accepts a list of products", () => {
            const products = [
                product,
                { ...product, id: "00000000-0000-4000-8000-000000000004" },
            ];
            expect(productListSchema.parse(products)).toEqual(products);
        });

        it("rejects a list containing an invalid product", () => {
            expect(
                productListSchema.safeParse([
                    product,
                    { ...product, price: -1 },
                ]),
            ).toMatchObject({
                success: false,
                error: { issues: [{ path: [1, "price"] }] },
            });
        });

        it.each([null, {}, "products"])(
            "rejects a non-array response",
            (value) => {
                expect(productListSchema.safeParse(value).success).toBe(false);
            },
        );
    });

    it.each([0, 101, 2_147_483_647])(
        "accepts stock quantity %i",
        (stockQuantity) => {
            expect(
                productSchema.safeParse({ ...product, stockQuantity }).success,
            ).toBe(true);
        },
    );

    it.each([-1, 0.5, 2_147_483_648, "5", undefined])(
        "rejects invalid stock quantity %s",
        (stockQuantity) => {
            expect(
                productSchema.safeParse({ ...product, stockQuantity }).success,
            ).toBe(false);
        },
    );

    it.each([0, 100])("accepts discount %i", (discountPercent) => {
        expect(
            productSchema.safeParse({ ...product, discountPercent }).success,
        ).toBe(true);
    });

    it.each([-1, 0.5, 101, "10", undefined])(
        "rejects invalid discount %s",
        (discountPercent) => {
            expect(
                productSchema.safeParse({ ...product, discountPercent })
                    .success,
            ).toBe(false);
        },
    );

    it.each(["0.00", "0.01", "29.99", "99999999.99"])(
        "accepts price %s",
        (price) => {
            expect(productSchema.parse({ ...product, price }).price).toBe(
                price,
            );
        },
    );

    it.each([
        0,
        undefined,
        null,
        "",
        "29",
        "29.9",
        "29.999",
        "100000000.00",
        "-1.00",
        "01.00",
        ".50",
        "29x99",
        "29.99\n",
    ])("rejects invalid price %s", (price) => {
        expect(productSchema.safeParse({ ...product, price }).success).toBe(
            false,
        );
    });
});
