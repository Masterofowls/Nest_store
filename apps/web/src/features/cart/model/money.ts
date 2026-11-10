export function priceInCents(price: string): bigint {
    if (!/^\d+(?:\.\d{1,2})?$/.test(price)) {
        throw new Error("Price must be a decimal amount");
    }
    const [whole, fraction = ""] = price.split(".");
    return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function discountedUnitCents(
    price: string,
    discountPercent: number,
): bigint {
    if (
        !Number.isInteger(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
    ) {
        throw new Error("Discount must be between 0 and 100");
    }
    return (
        (priceInCents(price) * BigInt(100 - discountPercent) + BigInt(50)) /
        BigInt(100)
    );
}

export function formatCents(cents: bigint): string {
    return `$${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
}

export function amountInCents(amount: string): bigint {
    return priceInCents(amount);
}
