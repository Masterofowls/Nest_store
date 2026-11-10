"use client";

import Link from "next/link";
import {
    useCancelOrderMutation,
    useGetCurrentUserQuery,
    useGetOrderQuery,
} from "@/shared/api/baseApi";
import { amountInCents, formatCents } from "@/features/cart/model/money";
import Skeleton from "./Skeleton";

type OrderDetailProps = { orderId: string };

export default function OrderDetail({ orderId }: OrderDetailProps) {
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const orderQuery = useGetOrderQuery(orderId, { skip: !user });
    const [cancelOrder, cancelState] = useCancelOrderMutation();

    if (isLoadingUser) return <Skeleton label="your session" />;
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in</Link> to view this order.
            </p>
        );

    const order = orderQuery.data;
    return (
        <section aria-labelledby="order-heading">
            <h1 id="order-heading">Order details</h1>
            {orderQuery.isLoading ? <Skeleton label="order details" /> : null}
            {orderQuery.isError && (
                <p role="alert">
                    Couldn't load this order.{" "}
                    <button
                        type="button"
                        onClick={() => void orderQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {order && (
                <>
                    <p>Status: {order.status}</p>
                    <ul>
                        {order.items.map((item) => (
                            <li key={item.id}>
                                {item.productId ? (
                                    <Link href={`/products/${item.productId}`}>
                                        {item.productName}
                                    </Link>
                                ) : (
                                    item.productName
                                )}
                                {` × ${item.quantity} — ${formatCents(amountInCents(item.unitPrice))} each`}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Total: {formatCents(amountInCents(order.totalAmount))}
                    </p>
                    {cancelState.isError && (
                        <p role="alert">
                            Couldn't cancel this order. It may no longer be
                            pending.
                        </p>
                    )}
                    {order.status === "pending" && (
                        <button
                            type="button"
                            disabled={cancelState.isLoading}
                            onClick={() => void cancelOrder(order.id)}
                        >
                            {cancelState.isLoading
                                ? "Cancelling…"
                                : "Cancel order"}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}
