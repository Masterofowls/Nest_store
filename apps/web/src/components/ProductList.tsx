"use client";

import { useGetProductsQuery } from "@/shared/api/baseApi";
import ProductTile from "./ProductTile";

const productPageSize = 10;

type ProductListProps = {
    page: number;
    search: string;
    onPageChange: (page: number) => void;
};

export default function ProductList({
    page,
    search,
    onPageChange,
}: ProductListProps) {
    const {
        currentData: products,
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useGetProductsQuery({
        page,
        limit: productPageSize,
        search: search || undefined,
    });
    const nextPageQuery = useGetProductsQuery(
        {
            page: page + 1,
            limit: productPageSize,
            search: search || undefined,
        },
        { skip: !products || products.length < productPageSize },
    );
    const hasNextPage = Boolean(nextPageQuery.currentData?.length);

    return (
        <section aria-labelledby="product-list-heading">
            <h2 id="product-list-heading" className="mb-4">
                Products
            </h2>
            {isLoading && !products && <output>Loading products...</output>}
            {isError && (
                <p role="alert">
                    Couldn't load products.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {nextPageQuery.isError && (
                <p role="alert">
                    Couldn't check for more products.{" "}
                    <button
                        type="button"
                        onClick={() => void nextPageQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {!isLoading && !isError && (!products || products.length === 0) && (
                <p>No products found.</p>
            )}
            {products && products.length > 0 && (
                <>
                    {isFetching && <output>Updating products...</output>}
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {products.map((product, index) => (
                            <li className="min-w-0" key={product.id}>
                                <ProductTile
                                    product={product}
                                    imageLoading={page === 1 && index === 0}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {(page > 1 || products?.length === productPageSize) && (
                <nav
                    aria-label="Product pages"
                    className="mt-6 flex flex-wrap items-center gap-3"
                >
                    <button
                        type="button"
                        disabled={page === 1 || isFetching}
                        onClick={() => onPageChange(page - 1)}
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
                        onClick={() => onPageChange(page + 1)}
                    >
                        Next page
                    </button>
                </nav>
            )}
        </section>
    );
}
