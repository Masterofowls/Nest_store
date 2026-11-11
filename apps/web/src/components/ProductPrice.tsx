import {
    discountedUnitCents,
    formatCents,
    priceInCents,
} from "@/features/cart/model/money";

type ProductPriceProps = {
    price: string;
    discountPercent: number;
};

function readPrices(price: string, discountPercent: number) {
    try {
        return {
            current: formatCents(discountedUnitCents(price, discountPercent)),
            original: formatCents(priceInCents(price)),
        };
    } catch {
        return { current: price, original: price };
    }
}

export default function ProductPrice({
    price,
    discountPercent,
}: ProductPriceProps) {
    const hasDiscount = discountPercent > 0;
    const { current, original } = readPrices(price, discountPercent);

    return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="sr-only">Price</span>
            <strong
                className={`font-display text-lg leading-tight font-semibold tracking-tight ${hasDiscount ? "text-store-sale" : "text-store-ink"}`}
            >
                {current}
            </strong>
            {hasDiscount && (
                <>
                    <s className="text-sm text-store-muted">
                        <span className="sr-only">Was </span>
                        {original}
                    </s>
                    <span className="rounded-control bg-store-sale px-2 py-0.5 text-xs font-bold text-white">
                        −{discountPercent}%
                    </span>
                </>
            )}
        </p>
    );
}
