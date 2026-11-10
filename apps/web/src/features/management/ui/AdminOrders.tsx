"use client";

import { useState } from "react";
import {
    useCancelManagedOrderMutation,
    useManagementOrderQuery,
    useManagementOrdersQuery,
} from "../api/management-api";

function OrderDetail({ id }: { id: string }) {
    const query = useManagementOrderQuery(id);
    if (query.isLoading) return <output>Loading order…</output>;
    if (query.isError)
        return (
            <p role="alert">
                Couldn't load order.{" "}
                <button onClick={() => void query.refetch()}>Retry</button>
            </p>
        );
    return (
        query.data && (
            <section>
                <h3>Order {id}</h3>
                <ul>
                    {query.data.items.map((item) => (
                        <li key={item.id}>
                            {item.productName}: {item.quantity} ×{" "}
                            {item.unitPrice}
                        </li>
                    ))}
                </ul>
            </section>
        )
    );
}

export default function AdminOrders() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const query = useManagementOrdersQuery({
        page,
        status: status || undefined,
    });
    const [cancel, state] = useCancelManagedOrderMutation();
    async function cancelOrder(id: string) {
        if (!window.confirm("Cancel this order and restore its stock?")) return;
        try {
            await cancel(id).unwrap();
            setMessage("Order cancelled.");
        } catch {
            setMessage("Couldn't cancel this order. Try again.");
        }
    }
    return (
        <section>
            <h2>Orders</h2>
            <label>
                Status{" "}
                <select
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">All orders</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </label>
            {query.isFetching && <output>Loading orders…</output>}
            {query.isError && (
                <p role="alert">
                    Couldn't load orders.{" "}
                    <button onClick={() => void query.refetch()}>Retry</button>
                </p>
            )}
            {query.currentData?.length === 0 && !query.isFetching && (
                <p>No orders found.</p>
            )}
            <ul>
                {query.currentData?.map((order) => (
                    <li key={order.id}>
                        {order.id} — {order.customerEmail ?? "Deleted account"}{" "}
                        — {order.totalAmount} — {order.status}{" "}
                        <button
                            type="button"
                            onClick={() => setSelected(order.id)}
                        >
                            Details
                        </button>{" "}
                        {order.status === "pending" && (
                            <button
                                type="button"
                                disabled={state.isLoading}
                                onClick={() => void cancelOrder(order.id)}
                            >
                                Cancel order
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            <nav aria-label="Order pages">
                <button
                    disabled={page === 1 || query.isFetching}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>{" "}
                Page {page}{" "}
                <button
                    disabled={
                        query.isFetching ||
                        !query.currentData ||
                        query.currentData.length < 20
                    }
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </nav>
            {selected && <OrderDetail id={selected} />}
            {message && <output>{message}</output>}
        </section>
    );
}
