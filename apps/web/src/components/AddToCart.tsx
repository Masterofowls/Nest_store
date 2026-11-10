"use client";

import Link from "next/link";
import { useState } from "react";
import {
    useGetCurrentUserQuery,
    useAddCartItemMutation,
} from "@/shared/api/baseApi";
import Skeleton from "./Skeleton";

type AddToCartProps = {
    productId: string;
    quantity: number;
};

export default function AddToCart({ productId, quantity }: AddToCartProps) {
    const { data: user, isLoading, isError } = useGetCurrentUserQuery();
    const [addCartItem, { isLoading: isAdding }] = useAddCartItemMutation();
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function handleAdd() {
        setMessage("");
        setError("");
        try {
            await addCartItem({ productId, quantity }).unwrap();
            setMessage("Added to cart");
        } catch {
            setError("Couldn't add this product to your cart. Try again.");
        }
    }

    if (isLoading) return <Skeleton label="your session" lines={1} />;
    if (isError) return <p role="alert">Couldn't check your session.</p>;
    if (!user) {
        return (
            <p>
                <Link href="/login">Sign in to add to cart</Link>
            </p>
        );
    }

    return (
        <div className="my-3">
            <button
                className="border-0 bg-store-primary px-5 text-white hover:bg-store-primary-hover"
                type="button"
                disabled={isAdding}
                onClick={() => void handleAdd()}
            >
                {isAdding ? "Adding…" : "Add to cart"}
            </button>
            {message && <output aria-live="polite">{message}</output>}
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
