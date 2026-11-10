"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useGetCurrentUserQuery,
    useGetCartQuery,
    useCheckoutMutation,
} from "@/shared/api/baseApi";
import { getErrorStatus } from "@/shared/api/response";
import { discountedUnitCents, formatCents } from "@/features/cart/model/money";
import { paymentSchema } from "@/features/checkout/model/payment.schema";
import Skeleton from "./Skeleton";

export default function Checkout() {
    const router = useRouter();
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const cartQuery = useGetCartQuery(undefined, { skip: !user });
    const [checkout, checkoutState] = useCheckoutMutation();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const items = cartQuery.data?.items ?? [];
    const total = items.reduce(
        (sum, item) =>
            sum +
            discountedUnitCents(
                item.product.price,
                item.product.discountPercent,
            ) *
                BigInt(item.quantity),
        BigInt(0),
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        const formData = new FormData(event.currentTarget);
        const result = paymentSchema.safeParse({
            cardholderName: formData.get("cardholderName"),
            cardNumber: formData.get("cardNumber"),
            expiry: formData.get("expiry"),
            cvc: formData.get("cvc"),
        });
        if (!result.success) {
            const errors: Record<string, string> = {};
            for (const issue of result.error.issues) {
                const key = String(issue.path[0]);
                errors[key] ??= issue.message;
            }
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        try {
            const order = await checkout(
                globalThis.crypto.randomUUID(),
            ).unwrap();
            router.push(`/orders/${order.id}`);
        } catch (checkoutError) {
            setError(
                getErrorStatus(checkoutError) === 409
                    ? "Your cart changed or an item is out of stock. Review your cart and try again."
                    : "Couldn't place your order. Try again.",
            );
        }
    }

    if (isLoadingUser) return <Skeleton label="your session" />;
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in</Link> to continue to checkout.
            </p>
        );

    return (
        <section aria-labelledby="checkout-heading">
            <h1 id="checkout-heading">Checkout</h1>
            <p>Test payment — no real charge</p>
            {cartQuery.isLoading ? <Skeleton label="order summary" /> : null}
            {cartQuery.isError && (
                <p role="alert">
                    Couldn't load your cart.{" "}
                    <button
                        type="button"
                        onClick={() => void cartQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {cartQuery.data && items.length === 0 && (
                <p>
                    Your cart is empty.{" "}
                    <Link href="/catalog">Browse the catalog</Link>
                </p>
            )}
            {items.length > 0 && (
                <>
                    <section
                        className="mb-6 rounded-2xl bg-store-surface p-6"
                        aria-labelledby="checkout-summary-heading"
                    >
                        <h2 id="checkout-summary-heading">Order summary</h2>
                        <ul>
                            {items.map((item) => (
                                <li key={item.id}>
                                    {item.product.name} × {item.quantity}:{" "}
                                    {formatCents(
                                        discountedUnitCents(
                                            item.product.price,
                                            item.product.discountPercent,
                                        ) * BigInt(item.quantity),
                                    )}
                                </li>
                            ))}
                        </ul>
                        <p>Total: {formatCents(total)}</p>
                    </section>
                    <form
                        className="max-w-lg"
                        onSubmit={(event) => void handleSubmit(event)}
                        autoComplete="off"
                        noValidate
                    >
                        <fieldset>
                            <legend>Test payment details</legend>
                            <div className="mb-3">
                                <label
                                    className="mb-2 block font-medium"
                                    htmlFor="cardholderName"
                                >
                                    Cardholder name
                                </label>
                                <input
                                    className="w-full"
                                    id="cardholderName"
                                    name="cardholderName"
                                    autoComplete="off"
                                    required
                                    aria-describedby={
                                        fieldErrors.cardholderName
                                            ? "cardholderName-error"
                                            : undefined
                                    }
                                />
                                {fieldErrors.cardholderName && (
                                    <p id="cardholderName-error" role="alert">
                                        {fieldErrors.cardholderName}
                                    </p>
                                )}
                            </div>
                            <div className="mb-3">
                                <label
                                    className="mb-2 block font-medium"
                                    htmlFor="cardNumber"
                                >
                                    Card number
                                </label>
                                <input
                                    className="w-full"
                                    id="cardNumber"
                                    name="cardNumber"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={16}
                                    required
                                    aria-describedby={
                                        fieldErrors.cardNumber
                                            ? "cardNumber-error"
                                            : undefined
                                    }
                                />
                                {fieldErrors.cardNumber && (
                                    <p id="cardNumber-error" role="alert">
                                        {fieldErrors.cardNumber}
                                    </p>
                                )}
                            </div>
                            <div className="mb-3">
                                <label
                                    className="mb-2 block font-medium"
                                    htmlFor="expiry"
                                >
                                    Expiry (MM/YY)
                                </label>
                                <input
                                    className="w-full"
                                    id="expiry"
                                    name="expiry"
                                    autoComplete="off"
                                    maxLength={5}
                                    placeholder="MM/YY"
                                    required
                                    aria-describedby={
                                        fieldErrors.expiry
                                            ? "expiry-error"
                                            : undefined
                                    }
                                />
                                {fieldErrors.expiry && (
                                    <p id="expiry-error" role="alert">
                                        {fieldErrors.expiry}
                                    </p>
                                )}
                            </div>
                            <div className="mb-3">
                                <label
                                    className="mb-2 block font-medium"
                                    htmlFor="cvc"
                                >
                                    CVC
                                </label>
                                <input
                                    className="w-full"
                                    id="cvc"
                                    name="cvc"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={4}
                                    required
                                    aria-describedby={
                                        fieldErrors.cvc
                                            ? "cvc-error"
                                            : undefined
                                    }
                                />
                                {fieldErrors.cvc && (
                                    <p id="cvc-error" role="alert">
                                        {fieldErrors.cvc}
                                    </p>
                                )}
                            </div>
                        </fieldset>
                        {error && <p role="alert">{error}</p>}
                        <button
                            className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                            type="submit"
                            disabled={checkoutState.isLoading}
                        >
                            {checkoutState.isLoading
                                ? "Placing order…"
                                : "Place test order"}
                        </button>
                    </form>
                </>
            )}
        </section>
    );
}
