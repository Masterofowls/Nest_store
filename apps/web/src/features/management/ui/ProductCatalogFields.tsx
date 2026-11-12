"use client";

import { useGetProductQuery } from "@/shared/api/baseApi";
import {
    type AttributeDefinition,
    type AttributeValueInput,
    useManagementAttributesQuery,
    useManagementBrandsQuery,
} from "../api/management-api";

const ATTRIBUTE_PREFIX = "attr:";

// Reads the attribute inputs of the product form. Empty inputs are left out,
// which removes that value from the product.
export function readAttributeValues(
    values: FormData,
    definitions: AttributeDefinition[],
): { values: AttributeValueInput[] } | { error: string } {
    const result: AttributeValueInput[] = [];
    for (const definition of definitions) {
        const raw = String(
            values.get(`${ATTRIBUTE_PREFIX}${definition.id}`) ?? "",
        ).trim();
        if (raw === "") continue;
        if (definition.type === "number") {
            const number = Number(raw);
            if (!Number.isFinite(number)) {
                return { error: `${definition.name} must be a number.` };
            }
            result.push({ attributeId: definition.id, value: number });
        } else if (definition.type === "boolean") {
            result.push({ attributeId: definition.id, value: raw === "true" });
        } else {
            result.push({ attributeId: definition.id, value: raw });
        }
    }
    return { values: result };
}

type ProductCatalogFieldsProps = {
    productId?: string;
    initialBrandId?: string | null;
    // Attribute definitions shown in the form, reported once loaded so the
    // form knows which inputs to read.
    attributes: AttributeDefinition[] | undefined;
    isAttributeError: boolean;
    onRetryAttributes: () => void;
};

export function useProductAttributes(categoryId: string) {
    return useManagementAttributesQuery(categoryId || undefined);
}

export default function ProductCatalogFields({
    productId,
    initialBrandId,
    attributes,
    isAttributeError,
    onRetryAttributes,
}: ProductCatalogFieldsProps) {
    const brands = useManagementBrandsQuery();
    // Stored values come from the product detail, matched by attribute slug.
    const { currentData: detail, isFetching: isLoadingDetail } =
        useGetProductQuery(productId ?? "", { skip: !productId });
    const stored = new Map(
        detail?.attributes.map((attribute) => [
            attribute.slug,
            attribute.value,
        ]),
    );
    const variantCount = detail?.variants.length ?? 0;

    return (
        <>
            <p>
                {/* Rendered only with its options, so the stored brand is
                    selected; without the field the brand is left unchanged. */}
                {brands.currentData ? (
                    <label>
                        Brand{" "}
                        <select
                            className="ml-2"
                            name="brandId"
                            defaultValue={initialBrandId ?? ""}
                        >
                            <option value="">No brand</option>
                            {brands.currentData.map((brand) => (
                                <option key={brand.id} value={brand.id}>
                                    {brand.name}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    !brands.isError && <output>Loading brands…</output>
                )}
                {brands.isError && (
                    <span role="alert">
                        Couldn't load brands. Saving now keeps the stored brand.{" "}
                        <button
                            type="button"
                            onClick={() => void brands.refetch()}
                        >
                            Retry
                        </button>
                    </span>
                )}
            </p>

            <fieldset className="space-y-3">
                <legend className="font-semibold">Specifications</legend>
                {isAttributeError && (
                    <p role="alert">
                        Couldn't load the specification fields. Saving now keeps
                        the stored values.{" "}
                        <button type="button" onClick={onRetryAttributes}>
                            Retry
                        </button>
                    </p>
                )}
                {(!attributes || (productId && isLoadingDetail)) &&
                    !isAttributeError && (
                        <output>Loading specification fields…</output>
                    )}
                {attributes?.length === 0 && (
                    <p className="text-store-muted">
                        No specifications are defined for this category.
                    </p>
                )}
                {attributes && !(productId && isLoadingDetail) && (
                    // Tells the form the inputs below are complete, so an
                    // empty one means "remove this value".
                    <input type="hidden" name="attributesReady" value="1" />
                )}
                {attributes &&
                    !(productId && isLoadingDetail) &&
                    attributes.map((attribute) => {
                        const name = `${ATTRIBUTE_PREFIX}${attribute.id}`;
                        const value = stored.get(attribute.slug) ?? "";
                        const label = attribute.unit
                            ? `${attribute.name}, ${attribute.unit}`
                            : attribute.name;
                        return (
                            <p key={attribute.id}>
                                <label>
                                    {label}{" "}
                                    {attribute.type === "boolean" ? (
                                        <select
                                            className="ml-2"
                                            name={name}
                                            defaultValue={value}
                                        >
                                            <option value="">Not set</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    ) : (
                                        <input
                                            className="ml-2"
                                            name={name}
                                            inputMode={
                                                attribute.type === "number"
                                                    ? "decimal"
                                                    : undefined
                                            }
                                            maxLength={200}
                                            defaultValue={value}
                                        />
                                    )}
                                </label>
                            </p>
                        );
                    })}
            </fieldset>

            <p>
                <label>
                    Variant of product (ID){" "}
                    <input
                        className="ml-2"
                        name="variantOfProductId"
                        pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                        aria-describedby="variant-help"
                    />
                </label>
                <span
                    className="block text-sm text-store-muted"
                    id="variant-help"
                >
                    {variantCount > 1
                        ? `This product is one of ${variantCount} variants. Enter another product ID to move it to that product's group.`
                        : "Enter the ID of one of your products to show both as variants, for example two colours. Leave empty to keep it as is."}
                </span>
            </p>
        </>
    );
}
