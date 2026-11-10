"use client";

import { useState } from "react";

type QuantitySelectorProps = { unitPrice: number}

export default function QuantitySelector({ unitPrice }: QuantitySelectorProps) {
    const [quantity, setQuantity] = useState(1);

    
    const total = quantity * unitPrice;

    function handleIncrease() {
        setQuantity((prev) => prev + 1);
    }

    function handleDecrease() {
        setQuantity((prev) => prev - 1);
    }
    return (
        <div>
            <p>Quantity: {quantity}</p>
            <p>Unit price: {unitPrice}</p>
            <p>Total: {total}</p>
            <button type="button" onClick={handleIncrease}>
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
