"use client";

import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import ProductPrice from "@/components/ProductPrice";
import {
    productHref,
    type ProductAttribute,
    type ProductDetail,
} from "@/entities/product/model/product.schema";
import { useGetComparedProductsQuery } from "@/shared/api/baseApi";
import {
    compareCleared,
    compareToggled,
    selectComparedIds,
    selectIsCompareLoaded,
} from "../model/compareSlice";

export function attributeValueLabel(attribute: ProductAttribute): string {
    if (attribute.type === "boolean") {
        return attribute.value === "true" ? "Yes" : "No";
    }
    return attribute.unit
        ? `${attribute.value} ${attribute.unit}`
        : attribute.value;
}

// One row per attribute any compared product has, in first-seen order.
function attributeRows(products: ProductDetail[]) {
    const rows = new Map<string, string>();
    for (const product of products) {
        for (const attribute of product.attributes) {
            if (!rows.has(attribute.slug)) {
                rows.set(attribute.slug, attribute.name);
            }
        }
    }
    return [...rows].map(([slug, name]) => ({ slug, name }));
}

export default function Compare() {
    const dispatch = useAppDispatch();
    const ids = useAppSelector(selectComparedIds);
    const isLoaded = useAppSelector(selectIsCompareLoaded);
    const {
        currentData: products,
        isFetching,
        isError,
        refetch,
    } = useGetComparedProductsQuery(ids, { skip: ids.length === 0 });

    if (!isLoaded) {
        return <output>Loading comparison…</output>;
    }
    if (ids.length === 0) {
        return (
            <p>
                Nothing to compare yet. Add up to four products with the
                Compare button on a product.{" "}
                <Link href="/catalog">Open the catalog</Link>
            </p>
        );
    }
    if (isError) {
        return (
            <p role="alert">
                Couldn't load the comparison.{" "}
                <button type="button" onClick={() => void refetch()}>
                    Retry
                </button>
            </p>
        );
    }
    if (!products) {
        return <output>Loading comparison…</output>;
    }

    const rows = attributeRows(products);
    return (
        <>
            {isFetching && <output>Updating comparison…</output>}
            <div className="overflow-x-auto rounded-panel bg-store-surface">
                <table className="min-w-[36rem]">
                    <caption className="sr-only">
                        Side-by-side comparison of {products.length} products
                    </caption>
                    <thead>
                        <tr>
                            <td />
                            {products.map((product) => (
                                <th
                                    className="align-top font-normal"
                                    key={product.id}
                                    scope="col"
                                >
                                    <Link
                                        className="font-semibold text-store-ink hover:text-store-primary"
                                        href={productHref(product)}
                                    >
                                        {product.name}
                                    </Link>
                                    <div className="mt-2">
                                        <ProductPrice
                                            price={product.price}
                                            discountPercent={
                                                product.discountPercent
                                            }
                                        />
                                    </div>
                                    <button
                                        className="mt-2 text-sm"
                                        type="button"
                                        aria-label={`Remove ${product.name} from comparison`}
                                        onClick={() =>
                                            dispatch(compareToggled(product.id))
                                        }
                                    >
                                        Remove
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th scope="row">Brand</th>
                            {products.map((product) => (
                                <td key={product.id}>
                                    {product.brand?.name ?? "—"}
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <th scope="row">Rating</th>
                            {products.map((product) => (
                                <td key={product.id}>
                                    {product.averageRating != null
                                        ? product.averageRating.toFixed(1)
                                        : "No reviews yet"}
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <th scope="row">Availability</th>
                            {products.map((product) => (
                                <td key={product.id}>
                                    {product.stockQuantity > 0
                                        ? "In stock"
                                        : "Out of stock"}
                                </td>
                            ))}
                        </tr>
                        {rows.map((row) => (
                            <tr key={row.slug}>
                                <th scope="row">{row.name}</th>
                                {products.map((product) => {
                                    const attribute = product.attributes.find(
                                        (item) => item.slug === row.slug,
                                    );
                                    return (
                                        <td key={product.id}>
                                            {attribute
                                                ? attributeValueLabel(attribute)
                                                : "—"}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button
                className="mt-4"
                type="button"
                onClick={() => dispatch(compareCleared())}
            >
                Clear comparison
            </button>
        </>
    );
}
