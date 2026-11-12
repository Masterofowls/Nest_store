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

    // A reduced price sits on a yellow shelf tag; a full price is plain.
    return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="sr-only">Price</span>
            <strong
                className={`font-display text-xl leading-tight font-bold ${hasDiscount ? "bg-store-tag py-0.5 pr-4 pl-2 text-store-tag-ink [clip-path:polygon(0_0,calc(100%-0.6rem)_0,100%_50%,calc(100%-0.6rem)_100%,0_100%)]" : "text-store-ink"}`}
            >
                {current}
            </strong>
            {hasDiscount && (
                <span className="text-sm text-store-muted">
                    <s>
                        <span className="sr-only">Was </span>
                        {original}
                    </s>{" "}
                    −{discountPercent}%
                </span>
            )}
        </p>
    );
}
