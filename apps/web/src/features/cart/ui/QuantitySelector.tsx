'use client'

import { useState } from "react";

export default function QuantitySelector() {
    const [quantity, setQuantity] = useState(1)

    function handleIncrease(){
        setQuantity((prev) => prev + 1)
    }

    function handleDecrease(){
        setQuantity((prev) => prev - 1)
    }
  return (
    <div>
      <p>Quantity {quantity}</p>
      <button type="button" onClick={handleIncrease}>Increase</button>
      <button type="button" disabled={quantity === 1} onClick={handleDecrease}>Decrease</button>
    </div>
  );
}