"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
    productHref,
    type ProductDetail,
} from "@/entities/product/model/product.schema";
import QuantitySelector from "@/features/cart/ui/QuantitySelector";
import { attributeValueLabel } from "@/features/compare/ui/Compare";
import CompareToggle from "@/features/compare/ui/CompareToggle";
import {
    useGetCategoriesQuery,
    useGetProductImagesQuery,
    useGetProductQuery,
    useGetSellerQuery,
} from "@/shared/api/baseApi";
import AddToCart from "./AddToCart";
import Breadcrumbs, { categoryCrumbs } from "./Breadcrumbs";
import CanonicalProductAddress from "./CanonicalProductAddress";
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

function VariantPicker({ product }: { product: ProductDetail }) {
    if (product.variants.length < 2) return null;
    const current = product.variants.find(
        (variant) => variant.id === product.id,
    );
    return (
        <div className="mb-6">
            <p className="mb-2 text-sm">
                <span className="text-store-muted">Variant: </span>
                <span className="font-semibold">
                    {current?.color ?? product.name}
                </span>
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Variants">
                {product.variants.map((variant) => {
                    const isCurrent = variant.id === product.id;
                    const label = variant.color ?? variant.name;
                    return (
                        <li key={variant.id}>
                            <Link
                                className={`inline-flex min-h-11 items-center rounded-control border-2 px-4 text-sm font-medium ${isCurrent ? "border-store-primary bg-store-primary-soft text-store-primary" : "border-store-border text-store-ink hover:border-store-primary hover:text-store-primary"} ${variant.stockQuantity === 0 ? "line-through" : ""}`}
                                href={productHref(variant)}
                                aria-current={isCurrent ? "page" : undefined}
                                aria-label={
                                    variant.stockQuantity === 0
                                        ? `${label}, out of stock`
                                        : undefined
                                }
                            >
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function Specifications({ product }: { product: ProductDetail }) {
    if (product.attributes.length === 0) return null;
    return (
        <section className="mt-6" aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="mb-2">
                Specifications
            </h2>
            <dl className="grid max-w-prose grid-cols-[minmax(0,1fr)_minmax(0,1fr)] text-sm">
                {product.attributes.map((attribute) => (
                    <div className="contents" key={attribute.slug}>
                        <dt className="border-b border-store-border py-2 pr-3 text-store-muted">
                            {attribute.name}
                        </dt>
                        <dd className="border-b border-store-border py-2">
                            {attributeValueLabel(attribute)}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
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
    const { data: categories } = useGetCategoriesQuery();
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
            <Breadcrumbs
                crumbs={categoryCrumbs(categories, product?.categoryId)}
                current={product?.name}
            />
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
                    {product.brand && (
                        <p className="mb-1 text-sm font-semibold text-store-muted">
                            {product.brand.name}
                        </p>
                    )}
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
                            <span className="bg-store-ink px-2 py-1 text-xs font-medium text-white">
                                {badgeLabel(product.badge)}
                            </span>
                        )}
                    </div>
                    <RecordProductView productId={product.id} />
                    <CanonicalProductAddress
                        reference={productId}
                        slug={product.slug}
                    />

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
                                <div className="relative aspect-square flex-1 overflow-hidden rounded-panel bg-store-tile">
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
                            <div className="flex flex-col gap-3 rounded-panel border border-store-border bg-store-surface p-5">
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
                                <CompareToggle
                                    productId={product.id}
                                    productName={product.name}
                                />
                            </div>
                            <SellerCard sellerId={product.sellerId} />
                        </aside>

                        <section
                            className="lg:col-start-2 lg:row-start-1"
                            aria-labelledby="about-heading"
                        >
                            <VariantPicker product={product} />
                            <h2 id="about-heading" className="mb-2">
                                About this product
                            </h2>
                            <p className="max-w-prose">
                                {product.description ??
                                    "No description provided."}
                            </p>
                            <Specifications product={product} />
                            <div className="mt-6">
                                <ShareProduct
                                    productId={product.id}
                                    slug={product.slug}
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
