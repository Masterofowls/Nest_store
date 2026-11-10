"use client";

import { useState } from "react";
import { useGetProductFeedQuery } from "@/shared/api/baseApi";
import ProductTile from "./ProductTile";

const productPageSize = 10;

type ProductListProps = {
    title?: string;
};

export default function ProductList({ title = "Products" }: ProductListProps) {
    const [page, setPage] = useState(1);
    const {
        data: products,
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useGetProductFeedQuery({ page, limit: productPageSize });
    // A short page means the feed reached the end.
    const loadedAll =
        products !== undefined && products.length < page * productPageSize;

    return (
        <section aria-labelledby="product-list-heading">
            <h2 id="product-list-heading" className="mb-4">
                {title}
            </h2>
            {isLoading && <output>Loading products...</output>}
            {!isLoading && !isError && products?.length === 0 && (
                <p>No products found.</p>
            )}
            {products && products.length > 0 && (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {products.map((product, index) => (
                        <li className="min-w-0" key={product.id}>
                            <ProductTile
                                product={product}
                                imageLoading={index === 0}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {isError && (
                <p role="alert" className="mt-4">
                    Couldn't load products.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {products && products.length > 0 && !loadedAll && !isError && (
                <div className="mt-8 flex justify-center">
                    <button
                        className="min-w-60"
                        type="button"
                        disabled={isFetching}
                        onClick={() => setPage((current) => current + 1)}
                    >
                        {isFetching ? "Loading…" : "Show more"}
                    </button>
                </div>
            )}
        </section>
    );
}
