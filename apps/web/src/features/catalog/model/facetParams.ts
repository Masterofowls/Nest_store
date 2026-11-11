import { z } from "zod";

export type AttributeSelection = Record<string, string[]>;

const MAX_BRANDS = 20;
const MAX_ATTRIBUTES = 10;
const MAX_VALUES = 20;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// These three separate values in the address, so a value cannot contain them.
const reservedPattern = /[|;:]/;

export function parseBrandIds(input: string): string[] {
    const ids = input.split(",").filter(Boolean);
    const valid = z.array(z.uuid()).max(MAX_BRANDS).safeParse(ids);
    return valid.success ? valid.data : [];
}

export function serializeBrandIds(ids: string[]): string | undefined {
    return ids.length > 0 ? ids.slice(0, MAX_BRANDS).join(",") : undefined;
}

// "color:Black|White;anc:true". A malformed address gives no selection
// rather than a partly applied one.
export function parseAttributeSelection(input: string): AttributeSelection {
    const selection: AttributeSelection = {};
    if (!input) return selection;
    const parts = input.split(";");
    if (parts.length > MAX_ATTRIBUTES) return {};
    for (const part of parts) {
        const separator = part.indexOf(":");
        const slug = part.slice(0, separator);
        const values = part.slice(separator + 1).split("|");
        if (
            separator <= 0 ||
            !slugPattern.test(slug) ||
            slug in selection ||
            values.length > MAX_VALUES ||
            values.some((value) => value.length === 0 || value.length > 100)
        ) {
            return {};
        }
        selection[slug] = values;
    }
    return selection;
}

export function serializeAttributeSelection(
    selection: AttributeSelection,
): string | undefined {
    const parts = Object.entries(selection)
        .filter(([, values]) => values.length > 0)
        .slice(0, MAX_ATTRIBUTES)
        .map(([slug, values]) => `${slug}:${values.join("|")}`);
    return parts.length > 0 ? parts.join(";") : undefined;
}

export function isSelectableValue(value: string): boolean {
    return (
        value.length > 0 && value.length <= 100 && !reservedPattern.test(value)
    );
}

export function toggleValue(values: string[], value: string): string[] {
    return values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value];
}
