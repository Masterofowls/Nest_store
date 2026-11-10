"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/entities/product/model/product.schema";
import {
    useGetProductImagesQuery,
    useGetProductRatingsQuery,
} from "@/shared/api/baseApi";
import TileCartControl from "@/features/cart/ui/TileCartControl";
import ProductPrice from "./ProductPrice";
import { badgeLabel, deliveryLabel, reviewCountLabel } from "./productLabels";
import { StarIcon } from "./StoreIcons";
import TileFavouriteToggle from "./TileFavouriteToggle";

type ProductTileProps = {
    product: Product;
    imageLoading?: boolean;
};

export default function ProductTile({
    product,
    imageLoading = false,
}: ProductTileProps) {
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
    } = useGetProductRatingsQuery(product.id, {
        skip: product.ratingCount !== undefined,
    });
    const firstImage = images?.[0];
    // Without server stats (e.g. recommendations), fall back to the newest
    // review score; the ratings endpoint returns only the latest few.
    const latestRating = ratings?.[0];
    const badge = badgeLabel(product.badge);
    const delivery =
        product.stockQuantity > 0 ? deliveryLabel(product.deliveryDays) : null;

    return (
        <article className="group relative flex h-full flex-col gap-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-tile bg-store-tile">
                {firstImage ? (
                    <Image
                        src={firstImage.url}
                        alt={`Image of ${product.name}`}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 240px"
                        unoptimized
                        loading={imageLoading ? "eager" : "lazy"}
                        className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
                    />
                ) : isLoadingImages ? (
                    <output className="flex h-full items-center justify-center p-3 text-sm text-store-muted">
                        Loading product image...
                    </output>
                ) : isImageError ? (
                    <p
                        className="relative z-10 flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-sm"
                        role="alert"
                    >
                        Couldn't load product images.
                        <button
                            type="button"
                            onClick={() => void refetchImages()}
                        >
                            Retry
                        </button>
                    </p>
                ) : (
                    <p className="flex h-full items-center justify-center p-3 text-center text-sm text-store-muted">
                        No product image available.
                    </p>
                )}
                {badge && (
                    <span className="absolute top-2 left-2 rounded-md bg-store-ink px-2 py-0.5 text-xs font-semibold text-white">
                        {badge}
                    </span>
                )}
                <TileFavouriteToggle
                    productId={product.id}
                    productName={product.name}
                />
            </div>

            <ProductPrice
                price={product.price}
                discountPercent={product.discountPercent}
            />

            <h3 className="line-clamp-2 text-sm leading-snug font-normal">
                <Link
                    className="text-store-ink after:absolute after:inset-0 after:rounded-tile hover:text-store-primary"
                    href={`/products/${product.id}`}
                >
                    {product.name}
                </Link>
            </h3>

            <div className="mt-auto flex flex-col gap-0.5 text-xs text-store-muted">
                {product.ratingCount !== undefined ? (
                    product.averageRating != null && product.ratingCount > 0 ? (
                        <p className="flex items-center gap-1">
                            <StarIcon className="size-3.5 text-store-rating" />
                            <span className="font-semibold text-store-ink">
                                {product.averageRating.toFixed(1)}
                            </span>
                            <span>{reviewCountLabel(product.ratingCount)}</span>
                        </p>
                    ) : (
                        <p>No reviews yet.</p>
                    )
                ) : isLoadingRatings ? (
                    <output>Loading reviews...</output>
                ) : isRatingError ? (
                    <p className="relative z-10" role="alert">
                        Couldn't load reviews.{" "}
                        <button
                            className="min-h-11 bg-transparent px-1 text-xs text-store-primary"
                            type="button"
                            onClick={() => void refetchRatings()}
                        >
                            Retry
                        </button>
                    </p>
                ) : latestRating ? (
                    <p className="flex items-center gap-1">
                        <StarIcon className="size-3.5 text-store-rating" />
                        <span className="font-semibold text-store-ink">
                            {latestRating.score}
                        </span>
                        <span>latest review</span>
                    </p>
                ) : (
                    <p>No reviews yet.</p>
                )}
                {delivery && (
                    <p className="font-medium text-store-primary">{delivery}</p>
                )}
                <p>
                    {product.stockQuantity > 0
                        ? `${product.stockQuantity} in stock`
                        : "Out of stock"}
                </p>
            </div>

            <TileCartControl
                productId={product.id}
                productName={product.name}
                stockQuantity={product.stockQuantity}
            />
        </article>
    );
}
