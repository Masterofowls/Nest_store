"use client";

import Image from "next/image";
import type { Product } from "@/entities/product/model/product.schema";
import {
    useGetProductImagesQuery,
    useGetProductRatingsQuery,
    useGetProductsQuery,
} from "@/shared/api/baseApi";

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
        <li>
            <article>
                <h2>{product.name}</h2>
                {firstImage ? (
                    <figure>
                        <Image
                            src={firstImage.url}
                            alt={`Image of ${product.name}`}
                            width={240}
                            height={180}
                            sizes="240px"
                            unoptimized
                            loading={imageLoading ? "eager" : "lazy"}
                            style={{
                                maxWidth: "100%",
                                height: "auto",
                                objectFit: "cover",
                            }}
                        />
                    </figure>
                ) : isLoadingImages ? (
                    <output>Loading product image...</output>
                ) : isImageError ? (
                    <p role="alert">
                        Couldn't load product images.{" "}
                        <button
                            type="button"
                            onClick={() => void refetchImages()}
                        >
                            Retry
                        </button>
                    </p>
                ) : (
                    <p>No product image available.</p>
                )}

                <p>{product.description ?? "No description provided."}</p>

                <dl>
                    <div>
                        <dt>Price</dt>
                        <dd>{product.price}</dd>
                    </div>
                    <div>
                        <dt>Stock</dt>
                        <dd>{product.stockQuantity} units</dd>
                    </div>
                    <div>
                        <dt>Discount</dt>
                        <dd>{product.discountPercent}%</dd>
                    </div>
                </dl>

                <section aria-label={`Reviews for ${product.name}`}>
                    <h3>Recent reviews</h3>
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

export default function ProductList() {
    const {
        data: products,
        isLoading,
        isError,
        refetch,
    } = useGetProductsQuery();

    return (
        <section aria-labelledby="product-list-heading">
            <h1 id="product-list-heading">Products</h1>
            {isLoading && !products && <output>Loading products...</output>}
            {isError && (
                <p role="alert">
                    Couldn't load products.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {!isLoading && !isError && (!products || products.length === 0) && (
                <p>No products found.</p>
            )}
            {products && products.length > 0 && (
                <ul>
                    {products.map((product, index) => (
                        <ProductListItem
                            key={product.id}
                            product={product}
                            imageLoading={index === 0}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
