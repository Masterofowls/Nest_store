import { describe, expect, it } from "vitest";
import { parseApiBase } from "./response";

describe("parseApiBase", () => {
    it.each(["http://localhost:3001/", "https://store.example.test/backend/"])(
        "returns a URL for a valid base %s",
        (input) => {
            expect(parseApiBase(input)).toEqual(new URL(input));
        },
    );

    it.each([
        "ftp://store.example.test/",
        "https://name:password@store.example.test/",
        "https://store.example.test/backend",
        "https://store.example.test/backend/?",
        "https://store.example.test/backend/?page=1",
        "https://store.example.test/backend/#",
        "https://store.example.test/backend/#section",
    ])("rejects an invalid base %s", (input) => {
        expect(() => parseApiBase(input)).toThrow("API base must");
    });

    it("rejects malformed URLs", () => {
        expect(() => parseApiBase("not-a-url")).toThrow(TypeError);
    });
});
