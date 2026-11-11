"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import QuantitySelector from "@/features/cart/ui/QuantitySelector";
import {
    useGetProductImagesQuery,
    useGetProductQuery,
    useGetSellerQuery,
} from "@/shared/api/baseApi";
import AddToCart from "./AddToCart";
import FavouriteButton from "./FavouriteButton";
import ProductPrice from "./ProductPrice";
import ProductReviews from "./ProductReviews";
import { badgeLabel, deliveryLabel, reviewCountLabel } from "./productLabels";
import RecommendationSection from "./RecommendationSection";
import RecordProductView from "./RecordProductView";
import ShareProduct from "./ShareProduct";
import { StarIcon, TruckIcon } from "./StoreIcons";

type ProductItemProps = {
    productId: string;
};

function SellerCard({ sellerId }: { sellerId: string }) {
    const { data: seller } = useGetSellerQuery(sellerId);
    return (
        <div className="rounded-tile border border-store-border p-4">
            <p className="text-sm text-store-muted">Seller</p>
            <p className="font-semibold">{seller?.storeName ?? "Store"}</p>
            <Link
                className="mt-1 inline-flex min-h-11 items-center text-sm"
                href={`/sellers/${sellerId}`}
            >
                Seller profile
            </Link>
        </div>
    );
}

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
        // The address may hold a slug, so images wait for the product's id.
    } = useGetProductImagesQuery(product?.id ?? "", { skip: !product });
    const [selectedImage, setSelectedImage] = useState({
        productId,
        index: 0,
    });
    const imageIndex =
        selectedImage.productId === productId ? selectedImage.index : 0;
    const currentImage = images?.[imageIndex] ?? images?.[0];
    const [selection, setSelection] = useState({ productId, quantity: 1 });
    const quantity = selection.productId === productId ? selection.quantity : 1;
    function setQuantity(nextQuantity: number) {
        setSelection({ productId, quantity: nextQuantity });
    }

    return (
        <section>
            <p>
                <Link
                    className="inline-flex min-h-11 items-center text-sm"
                    href="/"
                >
                    Back to products
                </Link>
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
                    <h1 className="mb-2">{product.name}</h1>
                    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-store-muted">
                        {product.averageRating != null &&
                        product.ratingCount ? (
                            <a
                                className="flex items-center gap-1"
                                href="#reviews"
                            >
                                <StarIcon className="size-4 text-store-rating" />
                                <span className="font-semibold text-store-ink">
                                    {product.averageRating.toFixed(1)}
                                </span>
                                {reviewCountLabel(product.ratingCount)}
                            </a>
                        ) : null}
                        {badgeLabel(product.badge) && (
                            <span className="rounded-control bg-store-accent px-2.5 py-0.5 text-xs font-semibold text-store-accent-ink">
                                {badgeLabel(product.badge)}
                            </span>
                        )}
                    </div>
                    <RecordProductView productId={product.id} />

                    <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)_20rem]">
                        <div className="lg:col-start-1 lg:row-start-1">
                            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                {images && images.length > 1 && (
                                    <ul
                                        className="flex gap-2 overflow-x-auto sm:flex-col"
                                        aria-label="Product photos"
                                    >
                                        {images.map((image, index) => (
                                            <li key={image.id}>
                                                <button
                                                    className={`relative size-16 overflow-hidden rounded-tile p-0 ${index === imageIndex ? "ring-2 ring-store-primary" : ""}`}
                                                    type="button"
                                                    aria-pressed={
                                                        index === imageIndex
                                                    }
                                                    aria-label={`Show photo ${index + 1} of ${images.length}`}
                                                    onClick={() =>
                                                        setSelectedImage({
                                                            productId,
                                                            index,
                                                        })
                                                    }
                                                >
                                                    <Image
                                                        src={image.url}
                                                        alt=""
                                                        fill
                                                        sizes="64px"
                                                        unoptimized
                                                        className="object-cover"
                                                    />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-panel bg-store-tile">
                                    {currentImage ? (
                                        <Image
                                            src={currentImage.url}
                                            alt={`Image of ${product.name}`}
                                            fill
                                            sizes="(max-width: 1024px) 100vw, 480px"
                                            unoptimized
                                            loading="eager"
                                            className="object-cover"
                                        />
                                    ) : isLoadingImages ? (
                                        <output className="flex h-full items-center justify-center">
                                            Loading product image…
                                        </output>
                                    ) : isImageError ? (
                                        <p
                                            className="flex h-full flex-col items-center justify-center gap-2"
                                            role="alert"
                                        >
                                            Couldn't load product images.
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void refetchImages()
                                                }
                                            >
                                                Retry
                                            </button>
                                        </p>
                                    ) : (
                                        <p className="flex h-full items-center justify-center text-store-muted">
                                            No product image available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <aside
                            aria-label="Buy"
                            className="flex flex-col gap-4 self-start lg:sticky lg:top-40 lg:col-start-3 lg:row-start-1"
                        >
                            <div className="flex flex-col gap-3 rounded-panel bg-store-surface p-5 shadow-panel">
                                <ProductPrice
                                    price={product.price}
                                    discountPercent={product.discountPercent}
                                />
                                {product.stockQuantity > 0 &&
                                    deliveryLabel(product.deliveryDays) && (
                                        <p className="flex items-center gap-2 text-sm font-medium text-store-primary">
                                            <TruckIcon className="size-5" />
                                            {deliveryLabel(
                                                product.deliveryDays,
                                            )}
                                        </p>
                                    )}
                                <p className="text-sm text-store-muted">
                                    {product.stockQuantity > 0
                                        ? `${product.stockQuantity} in stock`
                                        : "Out of stock"}
                                </p>
                                {product.stockQuantity > 0 && (
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
                                )}
                                <FavouriteButton productId={product.id} />
                            </div>
                            <SellerCard sellerId={product.sellerId} />
                        </aside>

                        <section
                            className="lg:col-start-2 lg:row-start-1"
                            aria-labelledby="about-heading"
                        >
                            <h2 id="about-heading" className="mb-2">
                                About this product
                            </h2>
                            <p className="max-w-prose">
                                {product.description ??
                                    "No description provided."}
                            </p>
                            <div className="mt-6">
                                <ShareProduct
                                    productId={product.id}
                                    name={product.name}
                                />
                            </div>
                        </section>
                    </div>

                    <ProductReviews
                        productId={product.id}
                        productName={product.name}
                        averageRating={product.averageRating}
                        ratingCount={product.ratingCount}
                    />

                    <RecommendationSection productId={product.id} />
                </article>
            )}
        </section>
    );
}
