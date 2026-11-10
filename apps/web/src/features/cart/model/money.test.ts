import { describe, expect, it } from "vitest";
import { discountedUnitCents, formatCents } from "./money";

describe("cart money", () => {
    it("rounds discounted unit amounts to cents before multiplying", () => {
        expect(discountedUnitCents("10.01", 50)).toBe(BigInt(501));
        expect(formatCents(discountedUnitCents("10.01", 50) * BigInt(3))).toBe(
            "$15.03",
        );
    });

    it("keeps full-price and free items exact", () => {
        expect(formatCents(discountedUnitCents("4.25", 0))).toBe("$4.25");
        expect(formatCents(discountedUnitCents("4.25", 100))).toBe("$0.00");
    });
});
