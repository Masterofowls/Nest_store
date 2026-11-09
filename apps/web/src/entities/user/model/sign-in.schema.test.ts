import { describe, expect, it } from "vitest";
import { signInSchema } from "./sign-in.schema";

describe("signInSchema", () => {
    it("accepts an email and preserves the password", () => {
        const input = {
            email: "buyer@example.test",
            password: " secret ",
        };
        expect(signInSchema.parse(input)).toEqual(input);
    });

    it.each(["", "a".repeat(7), "a".repeat(128)])(
        "accepts a password allowed by the sign-in endpoint",
        (password) => {
            expect(
                signInSchema.safeParse({
                    email: "buyer@example.test",
                    password,
                }).success,
            ).toBe(true);
        },
    );

    it.each([
        { email: "not-an-email", password: "password" },
        { email: "buyer@example.test", password: "a".repeat(129) },
        { email: "buyer@example.test", password: null },
        { email: "buyer@example.test" },
        { password: "password" },
        null,
    ])("rejects invalid sign-in data", (input) => {
        expect(signInSchema.safeParse(input).success).toBe(false);
    });
});
