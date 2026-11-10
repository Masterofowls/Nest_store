"use client";

import { useState, type FormEvent } from "react";

type SearchProps = {
    onSearch: (search: string) => void;
    initialSearch?: string;
};

export default function Search({ onSearch, initialSearch = "" }: SearchProps) {
    const [search, setSearch] = useState(initialSearch);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(search.trim());
    }

    return (
        <form
            aria-label="Search products"
            onSubmit={handleSubmit}
            className="mb-5"
        >
            <label
                htmlFor="product-search"
                className="mb-1.5 block text-sm font-medium text-store-muted"
            >
                Search products
            </label>
            <div className="flex rounded-tile border-2 border-store-primary bg-store-surface p-0.5">
                <input
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 text-base focus-visible:outline-offset-0"
                    id="product-search"
                    name="search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                />
                <button
                    className="rounded-[calc(var(--radius-tile)-2px)] bg-store-primary px-5 text-white hover:bg-store-primary-hover"
                    type="submit"
                >
                    Search
                </button>
            </div>
        </form>
    );
}
