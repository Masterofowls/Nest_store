import type { Product } from "@/entities/product/model/product.schema";

export function deliveryLabel(deliveryDays: number | undefined) {
    if (deliveryDays === undefined) return null;
    if (deliveryDays === 0) return "Delivery today";
    if (deliveryDays === 1) return "Delivery tomorrow";
    return `Delivery in ${deliveryDays} days`;
}

export function badgeLabel(badge: Product["badge"]) {
    if (badge === "bestseller") return "Bestseller";
    if (badge === "low_price") return "Low price";
    return null;
}

export function reviewCountLabel(count: number) {
    return count === 1 ? "1 review" : `${count} reviews`;
}
