"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import QuantitySelector from "@/features/cart/ui/QuantitySelector";
import AddToCart from "./AddToCart";
import FavouriteButton from "./FavouriteButton";
import RecordProductView from "./RecordProductView";
import ShareProduct from "./ShareProduct";
import {
    useGetProductImagesQuery,
    useGetProductQuery,
    useGetProductRatingsQuery,
} from "@/shared/api/baseApi";
import RecommendationSection from "./RecommendationSection";

type ProductItemProps = {
    productId: string;
};

export default function ProductItem({ productId }: ProductItemProps) {
    const {
        currentData: product,
        isLoading: isLoadingProduct,
        isError: isProductError,
        refetch: refetchProduct,
    } = useGetProductQuery(productId);
    const {
        data: images,
        isLoading: isLoadingImages,
        isError: isImageError,
        refetch: refetchImages,
    } = useGetProductImagesQuery(productId);
    const {
        data: ratings,
        isLoading: isLoadingRatings,
        isError: isRatingError,
        refetch: refetchRatings,
    } = useGetProductRatingsQuery(productId);
    const firstImage = images?.[0];
    const [selection, setSelection] = useState({ productId, quantity: 1 });
    const quantity = selection.productId === productId ? selection.quantity : 1;
    function setQuantity(nextQuantity: number) {
        setSelection({ productId, quantity: nextQuantity });
    }

    return (
        <section>
            <p>
                <Link href="/">Back to products</Link>
            </p>
            {isLoadingProduct && !product && <output>Loading product…</output>}
            {isProductError && (
                <p role="alert">
                    Couldn't load this product.{" "}
                    <button type="button" onClick={() => void refetchProduct()}>
                        Retry
                    </button>
                </p>
            )}
            {product && (
                <article>
                    <h1 className="my-4">{product.name}</h1>
                    {firstImage ? (
                        <figure className="mb-5 w-fit rounded-2xl bg-store-surface p-3">
                            <Image
                                src={firstImage.url}
                                alt={`Image of ${product.name}`}
                                width={600}
                                height={450}
                                sizes="(max-width: 640px) 100vw, 600px"
                                unoptimized
                                loading="eager"
                                className="h-auto max-w-full rounded-xl"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                    objectFit: "cover",
                                }}
                            />
                        </figure>
                    ) : isLoadingImages ? (
                        <output>Loading product image…</output>
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
                    <p>
                        Sold by{" "}
                        <Link href={`/sellers/${product.sellerId}`}>
                            Seller profile
                        </Link>
                    </p>
                    <RecordProductView productId={product.id} />

                    <dl className="my-4 rounded-2xl bg-store-surface p-5">
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

                    {product.stockQuantity > 0 ? (
                        <>
                            <QuantitySelector
                                key={product.id}
                                unitPrice={Number(product.price)}
                                maxQuantity={Math.min(
                                    product.stockQuantity,
                                    999,
                                )}
                                quantity={quantity}
                                onQuantityChange={setQuantity}
                            />
                            <AddToCart
                                productId={product.id}
                                quantity={quantity}
                            />
                        </>
                    ) : (
                        <p>Out of stock</p>
                    )}

                    <FavouriteButton productId={product.id} />
                    <ShareProduct productId={product.id} name={product.name} />

                    <section
                        className="mt-4"
                        aria-label={`Reviews for ${product.name}`}
                    >
                        <h2>Recent reviews</h2>
                        {isLoadingRatings ? (
                            <output>Loading reviews…</output>
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

                    <RecommendationSection productId={product.id} />
                </article>
            )}
        </section>
    );
}
