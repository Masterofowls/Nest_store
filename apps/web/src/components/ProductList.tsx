"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/entities/product/model/product.schema";
import {
    useGetProductImagesQuery,
    useGetProductRatingsQuery,
    useGetProductsQuery,
} from "@/shared/api/baseApi";

const productPageSize = 10;

type ProductListProps = {
    page: number;
    search: string;
    onPageChange: (page: number) => void;
};

function ProductListItem({
    product,
    imageLoading,
}: {
    product: Product;
    imageLoading: boolean;
}) {
    const {
        data: images,
        isLoading: isLoadingImages,
        isError: isImageError,
        refetch: refetchImages,
    } = useGetProductImagesQuery(product.id);
    const {
        data: ratings,
        isLoading: isLoadingRatings,
        isError: isRatingError,
        refetch: refetchRatings,
    } = useGetProductRatingsQuery(product.id);
    const firstImage = images?.[0];

    return (
        <li className="min-w-0">
            <article className="group flex h-full flex-col rounded-2xl bg-store-surface p-3 transition-transform duration-200 motion-safe:hover:-translate-y-1">
                <h2 className="order-3 text-base font-semibold leading-snug">
                    <Link
                        className="text-store-ink hover:text-store-primary"
                        href={`/products/${product.id}`}
                    >
                        {product.name}
                    </Link>
                </h2>
                {firstImage ? (
                    <figure className="order-1 aspect-[4/3] overflow-hidden rounded-xl bg-store-background">
                        <Image
                            src={firstImage.url}
                            alt={`Image of ${product.name}`}
                            width={240}
                            height={180}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                            unoptimized
                            loading={imageLoading ? "eager" : "lazy"}
                            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                        />
                    </figure>
                ) : isLoadingImages ? (
                    <output className="order-1 flex aspect-[4/3] items-center justify-center rounded-xl bg-store-background p-3 text-sm text-store-muted">
                        Loading product image...
                    </output>
                ) : isImageError ? (
                    <p
                        className="order-1 rounded-xl bg-store-background p-3"
                        role="alert"
                    >
                        Couldn't load product images.{" "}
                        <button
                            type="button"
                            onClick={() => void refetchImages()}
                        >
                            Retry
                        </button>
                    </p>
                ) : (
                    <p className="order-1 flex aspect-[4/3] items-center justify-center rounded-xl bg-store-background p-3 text-center text-sm text-store-muted">
                        No product image available.
                    </p>
                )}

                <p className="order-4 mt-2 text-sm text-store-muted">
                    {product.description ?? "No description provided."}
                </p>

                <dl className="order-2 mt-3 mb-2">
                    <div>
                        <dt className="sr-only">Price</dt>
                        <dd className="mb-1 text-xl font-bold text-store-primary">
                            {product.price}
                        </dd>
                    </div>
                    <div className="flex gap-2 text-sm text-store-muted">
                        <dt>Stock:</dt>
                        <dd>{product.stockQuantity} units</dd>
                    </div>
                    <div className="flex gap-2 text-sm text-store-sale">
                        <dt>Discount:</dt>
                        <dd>{product.discountPercent}%</dd>
                    </div>
                </dl>

                <section
                    className="order-5 mt-3 text-sm text-store-muted"
                    aria-label={`Reviews for ${product.name}`}
                >
                    <h3 className="text-sm font-semibold text-store-ink">
                        Recent reviews
                    </h3>
                    {isLoadingRatings ? (
                        <output>Loading reviews...</output>
                    ) : isRatingError ? (
                        <p role="alert">
                            Couldn't load reviews.{" "}
                            <button
                                type="button"
                                onClick={() => void refetchRatings()}
                            >
                                Retry
                            </button>
                        </p>
                    ) : ratings && ratings.length > 0 ? (
                        <ul>
                            {ratings.map((rating) => (
                                <li key={rating.id}>
                                    <p>Score: {rating.score} out of 5</p>
                                    {rating.comment !== null && (
                                        <p>{rating.comment}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No reviews yet.</p>
                    )}
                </section>
            </article>
        </li>
    );
}

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
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {products.map((product, index) => (
                            <ProductListItem
                                key={product.id}
                                product={product}
                                imageLoading={page === 1 && index === 0}
                            />
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
