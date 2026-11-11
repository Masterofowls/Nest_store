import { describe, expect, it } from "vitest";
import {
    isSelectableValue,
    parseAttributeSelection,
    parseBrandIds,
    serializeAttributeSelection,
    serializeBrandIds,
    toggleValue,
} from "./facetParams";

const brand = "00000000-0000-4000-8000-000000000201";

describe("facet address parameters", () => {
    it("round-trips an attribute selection", () => {
        const selection = { color: ["Black", "White"], anc: ["true"] };
        const serialized = serializeAttributeSelection(selection);
        expect(serialized).toBe("color:Black|White;anc:true");
        expect(parseAttributeSelection(serialized ?? "")).toEqual(selection);
    });

    it("omits attributes with nothing selected", () => {
        expect(serializeAttributeSelection({ color: [] })).toBeUndefined();
        expect(
            serializeAttributeSelection({ color: [], anc: ["false"] }),
        ).toBe("anc:false");
    });

    it.each([
        "color",
        ":Black",
        "Color:Black",
        "color:",
        "color:Black|",
        "color:Black;color:White",
    ])("ignores the malformed selection %s", (input) => {
        expect(parseAttributeSelection(input)).toEqual({});
    });

    it("keeps valid brand ids and drops a list containing a bad one", () => {
        expect(parseBrandIds(brand)).toEqual([brand]);
        expect(parseBrandIds(`${brand},nope`)).toEqual([]);
        expect(parseBrandIds("")).toEqual([]);
        expect(serializeBrandIds([])).toBeUndefined();
        expect(serializeBrandIds([brand])).toBe(brand);
    });

    it("rejects values that would break the address format", () => {
        expect(isSelectableValue("USB-C")).toBe(true);
        expect(isSelectableValue("a|b")).toBe(false);
        expect(isSelectableValue("a;b")).toBe(false);
        expect(isSelectableValue("a:b")).toBe(false);
    });

    it("adds and removes a value", () => {
        expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
        expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
    });
});
