import { describe, expect, it } from "vitest";
import { paymentSchema } from "./payment.schema";

const validPayment = {
    cardholderName: "Test Buyer",
    cardNumber: "4111111111111111",
    expiry: "12/99",
    cvc: "123",
};

describe("paymentSchema", () => {
    it("accepts a future-expiring card with a valid Luhn checksum", () => {
        expect(paymentSchema.safeParse(validPayment).success).toBe(true);
    });

    it("rejects an invalid checksum, expired date, and malformed CVC", () => {
        const result = paymentSchema.safeParse({
            ...validPayment,
            cardNumber: "4111111111111112",
            expiry: "01/20",
            cvc: "12",
        });
        expect(result.success).toBe(false);
        const issuePaths = result.success
            ? []
            : result.error.issues.map((issue) => issue.path[0]);
        expect(issuePaths).toEqual(
            expect.arrayContaining(["cardNumber", "expiry", "cvc"]),
        );
    });
});
