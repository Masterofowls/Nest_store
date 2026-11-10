import Link from "next/link";
import type { Product } from "@/entities/product/model/product.schema";

type CardProps = {
    product: Product;
};

export default function Card({ product }: CardProps) {
    return (
        <article className="h-full rounded-2xl bg-store-surface p-4 transition-transform duration-200 motion-safe:hover:-translate-y-1">
            <h3>
                <Link
                    className="text-store-ink hover:text-store-primary"
                    href={`/products/${product.id}`}
                >
                    {product.name}
                </Link>
            </h3>
            <dl className="mt-3 space-y-2 text-sm text-store-muted">
                <div>
                    <dt>Price</dt>
                    <dd>{product.price}</dd>
                </div>
                {product.discountPercent > 0 && (
                    <div>
                        <dt>Discount</dt>
                        <dd>{product.discountPercent}%</dd>
                    </div>
                )}
                <div>
                    <dt>Stock</dt>
                    <dd>
                        {product.stockQuantity > 0
                            ? `${product.stockQuantity} units`
                            : "Out of stock"}
                    </dd>
                </div>
            </dl>
        </article>
    );
}
