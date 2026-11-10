import Link from "next/link";
import type { Product } from "@/entities/product/model/product.schema";
import ProductPrice from "./ProductPrice";

type CardProps = {
    product: Product;
};

export default function Card({ product }: CardProps) {
    return (
        <article className="relative flex h-full flex-col gap-2 rounded-tile bg-store-tile p-3">
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
            <p className="mt-auto text-xs text-store-muted">
                {product.stockQuantity > 0
                    ? `${product.stockQuantity} in stock`
                    : "Out of stock"}
            </p>
        </article>
    );
}
