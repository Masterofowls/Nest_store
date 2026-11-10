"use client";

import Link from "next/link";
import {
    useGetCurrentUserQuery,
    useGetOrdersQuery,
} from "@/shared/api/baseApi";
import { amountInCents, formatCents } from "@/features/cart/model/money";
import Skeleton from "./Skeleton";

export default function Orders() {
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const ordersQuery = useGetOrdersQuery(undefined, { skip: !user });

    if (isLoadingUser) return <Skeleton label="your session" />;
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in</Link> to view your orders.
            </p>
        );

    return (
        <section aria-labelledby="orders-heading">
            <h1 id="orders-heading">Your orders</h1>
            {ordersQuery.isLoading ? <Skeleton label="orders" /> : null}
            {ordersQuery.isError && (
                <p role="alert">
                    Couldn't load your orders.{" "}
                    <button
                        type="button"
                        onClick={() => void ordersQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {ordersQuery.data?.length === 0 && (
                <p>You haven't placed any orders.</p>
            )}
            {ordersQuery.data && ordersQuery.data.length > 0 && (
                <ul className="grid gap-3">
                    {ordersQuery.data.map((order) => (
                        <li
                            className="rounded-2xl bg-store-surface p-4"
                            key={order.id}
                        >
                            <h2 className="break-all text-lg">
                                <Link href={`/orders/${order.id}`}>
                                    Order {order.id}
                                </Link>
                            </h2>
                            <p>Status: {order.status}</p>
                            <p>
                                Total:{" "}
                                {formatCents(amountInCents(order.totalAmount))}
                            </p>
                            <p>
                                Placed{" "}
                                {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
