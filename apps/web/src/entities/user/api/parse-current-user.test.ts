import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCurrentUser } from "./parse-current-user";

const user = {
    id: "user_123",
    name: "Morgan",
    email: "buyer@example.test",
    emailVerified: false,
    image: null,
};

describe("parseCurrentUser", () => {
    it("returns the validated user rather than the safeParse wrapper", () => {
        expect(parseCurrentUser(user)).toEqual(user);
    });

    it("returns the parsed user without extra fields", () => {
        expect(parseCurrentUser({ ...user, isAdmin: true })).toEqual(user);
    });

    it.each([null, {}, "invalid"])("rejects an invalid response", (value) => {
        expect(() => parseCurrentUser(value)).toThrow(
            "Invalid current user response",
        );
    });

    it("preserves validation details as the error cause", () => {
        expect(() =>
            parseCurrentUser({ ...user, emailVerified: "false" }),
        ).toThrow(
            expect.objectContaining({
                message: "Invalid current user response",
                cause: expect.any(ZodError),
            }),
        );
    });
});
