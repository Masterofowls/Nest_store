// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import User from "./User";

const user = {
    id: "user-1",
    name: "Daniil",
    email: "daniil@example.test",
    emailVerified: true,
    image: "https://images.example.test/avatar.webp",
};

afterEach(cleanup);

describe("User", () => {
    it("shows the account details and avatar", () => {
        const { container } = render(<User user={user} />);

        expect(screen.getByText("Daniil")).not.toBeNull();
        expect(screen.getByText("daniil@example.test")).not.toBeNull();
        expect(screen.getByText("Verified")).not.toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            user.image,
        );
    });

    it("omits the avatar and shows an unverified email", () => {
        const { container } = render(
            <User user={{ ...user, emailVerified: false, image: null }} />,
        );

        expect(screen.getByText("Not verified")).not.toBeNull();
        expect(container.querySelector("img")).toBeNull();
    });
});
