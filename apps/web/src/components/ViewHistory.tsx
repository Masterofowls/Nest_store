"use client";

import Link from "next/link";
import { useGetViewHistoryQuery } from "@/shared/api/baseApi";
import Skeleton from "./Skeleton";

export default function ViewHistory() {
    const {
        data: views,
        isLoading,
        isError,
        refetch,
    } = useGetViewHistoryQuery();

    return (
        <section aria-labelledby="view-history-heading">
            <h2 id="view-history-heading">Recently viewed</h2>
            {isLoading ? <Skeleton label="recently viewed products" /> : null}
            {isError && (
                <p role="alert">
                    Couldn't load recently viewed products.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {views?.length === 0 && <p>You haven't viewed any products yet.</p>}
            {views && views.length > 0 && (
                <ul>
                    {views.map((view) => (
                        <li key={view.id}>
                            <Link href={`/products/${view.productId}`}>
                                {view.productName}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
