import { describe, expect, it } from "vitest";
import { signUpSchema } from "./sign-up.schema";

describe("signUpSchema", () => {
    it("accepts a name, email address and password", () => {
        const input = {
            name: "Morgan",
            email: "buyer@example.test",
            password: "password",
        };
        expect(signUpSchema.parse(input)).toEqual(input);
    });

    it.each([
        { name: 42, email: "buyer@example.test", password: "password" },
        { name: "Morgan", email: "not-an-email", password: "password" },
        { name: "Morgan", password: "password" },
        { email: "buyer@example.test", password: "password" },
        null,
    ])("rejects invalid name or email data", (input) => {
        expect(signUpSchema.safeParse(input).success).toBe(false);
    });

    it.each([
        [7, false],
        [8, true],
        [128, true],
        [129, false],
    ])("validates a password of length %i", (length, expected) => {
        expect(
            signUpSchema.safeParse({
                name: "Morgan",
                email: "buyer@example.test",
                password: "a".repeat(length),
            }).success,
        ).toBe(expected);
    });

    it.each([undefined, null, 123])(
        "rejects a missing or non-string password",
        (password) => {
            expect(
                signUpSchema.safeParse({
                    name: "Morgan",
                    email: "buyer@example.test",
                    password,
                }).success,
            ).toBe(false);
        },
    );

    it("preserves password whitespace", () => {
        const input = {
            name: "Morgan",
            email: "buyer@example.test",
            password: " secret ",
        };
        expect(signUpSchema.parse(input).password).toBe(input.password);
    });
});
