"use client";

import { useState } from "react";
import { useManagementCategoriesQuery } from "../api/management-api";

export default function CategoryPicker({ initialId }: { initialId?: string }) {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(initialId ?? "");
    const query = useManagementCategoriesQuery(page);
    const hasSelected = query.currentData?.some(
        (category) => category.id === selected,
    );
    return (
        <div>
            <label>
                Category{" "}
                <select
                    name="categoryId"
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                    required
                >
                    <option value="">Select category</option>
                    {selected && !hasSelected && (
                        <option value={selected}>{selected}</option>
                    )}
                    {query.currentData?.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </label>
            {query.isFetching && <output>Loading categories…</output>}
            {query.isError && (
                <p role="alert">
                    Couldn't load categories.{" "}
                    <button type="button" onClick={() => void query.refetch()}>
                        Retry
                    </button>
                </p>
            )}
            <nav aria-label="Select category pages">
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
                        query.currentData.length < 20
                    }
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </nav>
        </div>
    );
}
