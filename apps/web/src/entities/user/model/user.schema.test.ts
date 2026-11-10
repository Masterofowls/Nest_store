import { describe, expect, it } from "vitest";
import { currentUserSchema } from "./user.schema";

const user = {
    id: "user_123",
    name: "Morgan",
    email: "buyer@example.test",
    emailVerified: false,
    image: null,
};

describe("currentUserSchema", () => {
    it("accepts a user with a non-UUID ID and a null image", () => {
        expect(currentUserSchema.parse(user)).toEqual(user);
    });

    it("accepts a string image and a verified email", () => {
        const verifiedUser = {
            ...user,
            emailVerified: true,
            image: "/profile.webp",
        };
        expect(currentUserSchema.parse(verifiedUser)).toEqual(verifiedUser);
    });

    it.each(["id", "name", "email", "emailVerified", "image"])(
        "rejects a response missing %s",
        (field) => {
            const incomplete = Object.fromEntries(
                Object.entries(user).filter(([key]) => key !== field),
            );
            expect(currentUserSchema.safeParse(incomplete).success).toBe(false);
        },
    );

    it.each([
        ["id", 1],
        ["name", null],
        ["email", false],
        ["emailVerified", "false"],
        ["image", 1],
    ])("rejects an invalid %s value", (field, value) => {
        expect(
            currentUserSchema.safeParse({ ...user, [field]: value }).success,
        ).toBe(false);
    });

    it.each([null, [], "user"])("rejects a non-object response", (value) => {
        expect(currentUserSchema.safeParse(value).success).toBe(false);
    });

    it("strips fields outside the current-user response", () => {
        expect(currentUserSchema.parse({ ...user, unexpected: true })).toEqual(
            user,
        );
    });

    it("preserves the server-owned admin flag", () => {
        expect(
            currentUserSchema.parse({ ...user, isAdmin: true }).isAdmin,
        ).toBe(true);
        expect(
            currentUserSchema.safeParse({ ...user, isAdmin: "true" }).success,
        ).toBe(false);
    });
});
