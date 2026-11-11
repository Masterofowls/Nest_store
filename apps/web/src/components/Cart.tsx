"use client";

import Link from "next/link";
import {
    useGetCurrentUserQuery,
    useGetCartQuery,
    useUpdateCartItemMutation,
    useRemoveCartItemMutation,
} from "@/shared/api/baseApi";
import { discountedUnitCents, formatCents } from "@/features/cart/model/money";
import Skeleton from "./Skeleton";

export default function Cart() {
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const cartQuery = useGetCartQuery(undefined, { skip: !user });
    const [updateCartItem, updateState] = useUpdateCartItemMutation();
    const [removeCartItem, removeState] = useRemoveCartItemMutation();
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

    if (isLoadingUser) return <Skeleton label="your session" />;
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in</Link> to view your cart.
            </p>
        );

    return (
        <section aria-labelledby="cart-heading">
            <h1 id="cart-heading">Your cart</h1>
            {cartQuery.isLoading ? <Skeleton label="cart" /> : null}
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
                    {(updateState.isError || removeState.isError) && (
                        <p role="alert">
                            Couldn't update your cart. Check available stock and
                            try again.
                        </p>
                    )}
                    <div className="overflow-x-auto rounded-panel bg-store-surface">
                        <table className="min-w-[700px]">
                            <thead>
                                <tr>
                                    <th scope="col">Product</th>
                                    <th scope="col">Unit price</th>
                                    <th scope="col">Quantity</th>
                                    <th scope="col">Line total</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const unitCents = discountedUnitCents(
                                        item.product.price,
                                        item.product.discountPercent,
                                    );
                                    const busy =
                                        updateState.isLoading ||
                                        removeState.isLoading;
                                    return (
                                        <tr key={item.id}>
                                            <th scope="row">
                                                <Link
                                                    href={`/products/${item.productId}`}
                                                >
                                                    {item.product.name}
                                                </Link>
                                            </th>
                                            <td>{formatCents(unitCents)}</td>
                                            <td>{item.quantity}</td>
                                            <td>
                                                {formatCents(
                                                    unitCents *
                                                        BigInt(item.quantity),
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    aria-label={`Decrease ${item.product.name} quantity`}
                                                    disabled={
                                                        busy ||
                                                        item.quantity <= 1
                                                    }
                                                    onClick={() =>
                                                        void updateCartItem({
                                                            id: item.id,
                                                            quantity:
                                                                item.quantity -
                                                                1,
                                                        })
                                                    }
                                                >
                                                    Decrease
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Increase ${item.product.name} quantity`}
                                                    disabled={
                                                        busy ||
                                                        item.quantity >=
                                                            Math.min(
                                                                item.product
                                                                    .stockQuantity,
                                                                999,
                                                            )
                                                    }
                                                    onClick={() =>
                                                        void updateCartItem({
                                                            id: item.id,
                                                            quantity:
                                                                item.quantity +
                                                                1,
                                                        })
                                                    }
                                                >
                                                    Increase
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void removeCartItem(
                                                            item.id,
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th scope="row" colSpan={3}>
                                        Cart total
                                    </th>
                                    <td colSpan={2}>{formatCents(total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <p>
                        <Link href="/checkout">Checkout</Link>
                    </p>
                </>
            )}
        </section>
    );
}
