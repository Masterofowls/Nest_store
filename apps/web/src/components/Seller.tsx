"use client";

import { useState } from "react";
import {
    useGetSellerProductsQuery,
    useGetSellerQuery,
} from "@/shared/api/baseApi";
import Card from "./Card";
import Skeleton from "./Skeleton";

const sellerPageSize = 12;
type SellerProps = { sellerId: string };

export default function Seller({ sellerId }: SellerProps) {
    const [page, setPage] = useState(1);
    const sellerQuery = useGetSellerQuery(sellerId);
    const productsQuery = useGetSellerProductsQuery({
        sellerId,
        page,
        limit: sellerPageSize,
    });
    const nextProductsQuery = useGetSellerProductsQuery(
        { sellerId, page: page + 1, limit: sellerPageSize },
        {
            skip:
                !productsQuery.data ||
                productsQuery.data.length < sellerPageSize,
        },
    );
    const products = productsQuery.data;

    return (
        <section aria-labelledby="seller-heading">
            {sellerQuery.isLoading ? (
                <Skeleton label="seller" lines={1} />
            ) : null}
            {sellerQuery.isError && (
                <p role="alert">
                    Couldn't load this seller.{" "}
                    <button
                        type="button"
                        onClick={() => void sellerQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {sellerQuery.data && (
                <>
                    <h1 id="seller-heading">{sellerQuery.data.storeName}</h1>
                    {sellerQuery.data.description && (
                        <p>{sellerQuery.data.description}</p>
                    )}
                    <section aria-labelledby="seller-products-heading">
                        <h2 id="seller-products-heading">Products</h2>
                        {productsQuery.isLoading ? (
                            <Skeleton label="seller products" />
                        ) : null}
                        {productsQuery.isError && (
                            <p role="alert">
                                Couldn't load products.{" "}
                                <button
                                    type="button"
                                    onClick={() => void productsQuery.refetch()}
                                >
                                    Retry
                                </button>
                            </p>
                        )}
                        {products?.length === 0 && (
                            <p>This seller has no products yet.</p>
                        )}
                        {products && products.length > 0 && (
                            <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {products.map((product) => (
                                    <li className="min-w-0" key={product.id}>
                                        <Card product={product} />
                                    </li>
                                ))}
                            </ul>
                        )}
                        {(page > 1 || products?.length === sellerPageSize) && (
                            <nav aria-label="Seller product pages">
                                <button
                                    type="button"
                                    disabled={
                                        page === 1 || productsQuery.isFetching
                                    }
                                    onClick={() => setPage(page - 1)}
                                >
                                    Previous page
                                </button>
                                <span aria-current="page">Page {page}</span>
                                <button
                                    type="button"
                                    disabled={
                                        !nextProductsQuery.data?.length ||
                                        productsQuery.isFetching ||
                                        nextProductsQuery.isFetching
                                    }
                                    onClick={() => setPage(page + 1)}
                                >
                                    Next page
                                </button>
                            </nav>
                        )}
                    </section>
                </>
            )}
        </section>
    );
}
