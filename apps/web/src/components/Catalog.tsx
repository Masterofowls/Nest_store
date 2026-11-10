"use client";

import { useId, useState } from "react";
import type { ProductSort } from "@/entities/product/model/product.schema";
import { useGetProductsQuery } from "@/shared/api/baseApi";
import Filters, { type CatalogFilters } from "./Filters";
import ProductTile from "./ProductTile";
import Search from "./Search";

const catalogPageSize = 12;

const sortOptions: { value: ProductSort | ""; label: string }[] = [
    { value: "", label: "Default" },
    { value: "popular", label: "Popular" },
    { value: "price_asc", label: "Price: low to high" },
    { value: "price_desc", label: "Price: high to low" },
    { value: "rating", label: "Highest rated" },
    { value: "newest", label: "Newest" },
];

type CatalogProps = {
    initialSearch?: string;
    initialCategoryId?: string;
};

export default function Catalog({
    initialSearch = "",
    initialCategoryId = "",
}: CatalogProps) {
    const [search, setSearch] = useState(initialSearch);
    const [sort, setSort] = useState<ProductSort | "">("");
    const [filters, setFilters] = useState<CatalogFilters>({
        categoryId: initialCategoryId,
        minPrice: "",
        maxPrice: "",
        discounted: false,
        inStock: false,
    });
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const filtersPanelId = useId();
    const query = {
        limit: catalogPageSize,
        search: search || undefined,
        categoryId: filters.categoryId || undefined,
        sort: sort || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        discounted: filters.discounted ? ("true" as const) : undefined,
        inStock: filters.inStock ? ("true" as const) : undefined,
    };
    const {
        currentData: products,
        isFetching,
        isError,
        refetch,
    } = useGetProductsQuery({ ...query, page });
    const nextPageQuery = useGetProductsQuery(
        { ...query, page: page + 1 },
        { skip: !products || products.length < catalogPageSize },
    );
    const hasNextPage = Boolean(nextPageQuery.currentData?.length);

    function handleSearch(nextSearch: string) {
        setSearch(nextSearch);
        setPage(1);
    }

    function handleFiltersChange(changes: Partial<CatalogFilters>) {
        setFilters((current) => ({ ...current, ...changes }));
        setPage(1);
    }

    return (
        <section aria-labelledby="catalog-heading">
            <h1 id="catalog-heading" className="mb-5">
                Catalog
            </h1>
            <Search onSearch={handleSearch} initialSearch={initialSearch} />

            <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
                <aside aria-label="Filters">
                    <button
                        className="w-full lg:hidden"
                        type="button"
                        aria-expanded={showFilters}
                        aria-controls={filtersPanelId}
                        onClick={() => setShowFilters((open) => !open)}
                    >
                        {showFilters ? "Hide filters" : "Show filters"}
                    </button>
                    <div
                        id={filtersPanelId}
                        className={`${showFilters ? "block" : "hidden"} mt-3 rounded-tile bg-store-tile p-4 lg:sticky lg:top-40 lg:mt-0 lg:block`}
                    >
                        <Filters
                            filters={filters}
                            onChange={handleFiltersChange}
                        />
                    </div>
                </aside>

                <section aria-labelledby="catalog-results-heading">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 id="catalog-results-heading">Products</h2>
                        <label className="flex items-center gap-2 text-sm text-store-muted">
                            Sort by
                            <select
                                value={sort}
                                onChange={(event) => {
                                    const { value } = event.currentTarget;
                                    setSort(
                                        sortOptions.find(
                                            (option) => option.value === value,
                                        )?.value ?? "",
                                    );
                                    setPage(1);
                                }}
                            >
                                {sortOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {isFetching && !products && (
                        <output>Loading products…</output>
                    )}
                    {isError && (
                        <p role="alert">
                            Couldn't load products.{" "}
                            <button
                                type="button"
                                onClick={() => void refetch()}
                            >
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
                            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                {products.map((product) => (
                                    <li className="min-w-0" key={product.id}>
                                        <ProductTile product={product} />
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
            </div>
        </section>
    );
}
