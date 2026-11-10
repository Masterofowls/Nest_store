"use client";

import { useState } from "react";

type QuantitySelectorProps = {
    unitPrice: number;
    maxQuantity?: number;
    quantity?: number;
    onQuantityChange?: (quantity: number) => void;
};

export default function QuantitySelector({
    unitPrice,
    maxQuantity = Number.POSITIVE_INFINITY,
    quantity: controlledQuantity,
    onQuantityChange,
}: QuantitySelectorProps) {
    const [internalQuantity, setInternalQuantity] = useState(1);
    const quantity = controlledQuantity ?? internalQuantity;

    const total = Math.round(quantity * unitPrice * 100) / 100;

    function changeQuantity(nextQuantity: number) {
        if (controlledQuantity === undefined) {
            setInternalQuantity(nextQuantity);
        }
        onQuantityChange?.(nextQuantity);
    }

    function handleIncrease() {
        changeQuantity(Math.min(quantity + 1, maxQuantity));
    }

    function handleDecrease() {
        changeQuantity(Math.max(1, quantity - 1));
    }
    return (
        <div className="my-3">
            <p>Quantity: {quantity}</p>
            <p>Unit price: {unitPrice}</p>
            <p>Total: {total}</p>
            <button
                className="mr-2"
                type="button"
                disabled={quantity >= maxQuantity}
                onClick={handleIncrease}
            >
                Increase
            </button>
            <button
                type="button"
                disabled={quantity === 1}
                onClick={handleDecrease}
            >
                Decrease
            </button>
        </div>
    );
}
