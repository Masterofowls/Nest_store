"use client";

import { useState } from "react";
import { useGetProductsQuery } from "@/shared/api/baseApi";
import Card from "./Card";
import Filters from "./Filters";
import Search from "./Search";

const catalogPageSize = 12;

export default function Catalog() {
    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [page, setPage] = useState(1);
    const filters = {
        limit: catalogPageSize,
        search: search || undefined,
        categoryId: categoryId || undefined,
    };
    const {
        currentData: products,
        isFetching,
        isError,
        refetch,
    } = useGetProductsQuery({ ...filters, page });
    const nextPageQuery = useGetProductsQuery(
        { ...filters, page: page + 1 },
        { skip: !products || products.length < catalogPageSize },
    );
    const hasNextPage = Boolean(nextPageQuery.currentData?.length);

    function handleSearch(nextSearch: string) {
        setSearch(nextSearch);
        setPage(1);
    }

    function handleCategoryChange(nextCategoryId: string) {
        setCategoryId(nextCategoryId);
        setPage(1);
    }

    return (
        <section aria-labelledby="catalog-heading">
            <h1 id="catalog-heading" className="mb-5">
                Catalog
            </h1>
            <Search onSearch={handleSearch} />
            <Filters
                categoryId={categoryId}
                onCategoryChange={handleCategoryChange}
            />
            <section aria-labelledby="catalog-results-heading">
                <h2 id="catalog-results-heading" className="mb-4">
                    Products
                </h2>
                {isFetching && !products && <output>Loading products…</output>}
                {isError && (
                    <p role="alert">
                        Couldn't load products.{" "}
                        <button type="button" onClick={() => void refetch()}>
                            Retry
                        </button>
                    </p>
                )}
                {!isFetching &&
                    !isError &&
                    (!products || products.length === 0) && (
                        <p>No products match these filters.</p>
                    )}
                {products && products.length > 0 && (
                    <>
                        {isFetching && <output>Updating products…</output>}
                        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                            {products.map((product) => (
                                <li className="min-w-0" key={product.id}>
                                    <Card product={product} />
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {(page > 1 || products?.length === catalogPageSize) && (
                    <nav
                        aria-label="Catalog pages"
                        className="mt-6 flex flex-wrap items-center gap-3"
                    >
                        <button
                            type="button"
                            disabled={page === 1 || isFetching}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous page
                        </button>
                        <span aria-current="page">Page {page}</span>
                        <button
                            type="button"
                            disabled={
                                !hasNextPage ||
                                isFetching ||
                                nextPageQuery.isFetching
                            }
                            onClick={() => setPage(page + 1)}
                        >
                            Next page
                        </button>
                    </nav>
                )}
            </section>
        </section>
    );
}
