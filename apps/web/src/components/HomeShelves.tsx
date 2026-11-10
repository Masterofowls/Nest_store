"use client";

import { type ReactNode, useId } from "react";
import type { Product } from "@/entities/product/model/product.schema";
import {
    useGetCurrentUserQuery,
    useGetProductQuery,
    useGetProductRecommendationsQuery,
    useGetViewHistoryQuery,
} from "@/shared/api/baseApi";
import ProductTile from "./ProductTile";

const maxShelfItems = 10;

function ProductShelf({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId} className="mb-10">
            <h2 id={headingId} className="mb-4">
                {title}
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {children}
            </ul>
        </section>
    );
}

function ShelfItem({ product }: { product: Product }) {
    return (
        <li className="w-40 shrink-0 snap-start sm:w-48">
            <ProductTile product={product} />
        </li>
    );
}

function ViewedShelfItem({ productId }: { productId: string }) {
    const { data: product } = useGetProductQuery(productId);
    return product ? <ShelfItem product={product} /> : null;
}

export default function HomeShelves() {
    const { data: user } = useGetCurrentUserQuery();
    const { data: views } = useGetViewHistoryQuery(undefined, {
        skip: !user,
    });
    const viewedIds = [
        ...new Set(views?.map((view) => view.productId) ?? []),
    ].slice(0, maxShelfItems);
    const lastViewed = views?.[0];
    const { data: similar } = useGetProductRecommendationsQuery(
        lastViewed?.productId ?? "",
        { skip: !lastViewed },
    );

    if (!user || viewedIds.length === 0) return null;

    return (
        <>
            <ProductShelf title="You viewed">
                {viewedIds.map((productId) => (
                    <ViewedShelfItem key={productId} productId={productId} />
                ))}
            </ProductShelf>
            {lastViewed && similar && similar.length > 0 && (
                <ProductShelf title={`Similar to ${lastViewed.productName}`}>
                    {similar.map((product) => (
                        <ShelfItem key={product.id} product={product} />
                    ))}
                </ProductShelf>
            )}
        </>
    );
}
