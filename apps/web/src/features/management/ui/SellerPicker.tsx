"use client";

import { useState } from "react";
import { useManagementSellersQuery } from "../api/management-api";

export default function SellerPicker() {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState("");
    const query = useManagementSellersQuery(page);
    const hasSelected = query.currentData?.some(
        (seller) => seller.id === selected,
    );
    return (
        <div>
            <label>
                Seller{" "}
                <select
                    name="sellerId"
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                    required
                >
                    <option value="">Select seller</option>
                    {selected && !hasSelected && (
                        <option value={selected}>{selected}</option>
                    )}
                    {query.currentData?.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                            {seller.storeName}
                        </option>
                    ))}
                </select>
            </label>
            {query.isFetching && <output>Loading sellers…</output>}
            {query.isError && (
                <p role="alert">
                    Couldn't load sellers.{" "}
                    <button type="button" onClick={() => void query.refetch()}>
                        Retry
                    </button>
                </p>
            )}
            <nav aria-label="Select seller pages">
                <button
                    type="button"
                    disabled={page === 1 || query.isFetching}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>{" "}
                Page {page}{" "}
                <button
                    type="button"
                    disabled={
                        query.isFetching ||
                        !query.currentData ||
                        query.currentData.length < 100
                    }
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </nav>
        </div>
    );
}
