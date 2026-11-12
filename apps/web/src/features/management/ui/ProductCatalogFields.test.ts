import { describe, expect, it } from "vitest";
import type { AttributeDefinition } from "../api/management-api";
import { readAttributeValues } from "./ProductCatalogFields";

function definition(
    id: string,
    type: AttributeDefinition["type"],
): AttributeDefinition {
    return {
        id,
        type,
        name: `Attribute ${id}`,
        slug: `attribute-${id}`,
        unit: null,
        categoryId: null,
        sortOrder: 0,
    };
}

const color = definition("00000000-0000-4000-8000-000000000301", "text");
const weight = definition("00000000-0000-4000-8000-000000000304", "number");
const anc = definition("00000000-0000-4000-8000-000000000303", "boolean");

function form(entries: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
}

describe("readAttributeValues", () => {
    it("converts each input to its attribute's type and skips empty ones", () => {
        expect(
            readAttributeValues(
                form({
                    [`attr:${color.id}`]: " Black ",
                    [`attr:${weight.id}`]: "58.5",
                    [`attr:${anc.id}`]: "false",
                }),
                [color, weight, anc],
            ),
        ).toEqual({
            values: [
                { attributeId: color.id, value: "Black" },
                { attributeId: weight.id, value: 58.5 },
                { attributeId: anc.id, value: false },
            ],
        });
        expect(
            readAttributeValues(form({ [`attr:${anc.id}`]: "" }), [color, anc]),
        ).toEqual({ values: [] });
    });

    it("reports a number that cannot be read", () => {
        expect(
            readAttributeValues(form({ [`attr:${weight.id}`]: "heavy" }), [
                weight,
            ]),
        ).toEqual({ error: `${weight.name} must be a number.` });
    });
});
