"use client";

import { useState, type FormEvent } from "react";

type SearchProps = {
    onSearch: (search: string) => void;
};

export default function Search({ onSearch }: SearchProps) {
    const [search, setSearch] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(search.trim());
    }

    return (
        <form
            aria-label="Search products"
            onSubmit={handleSubmit}
            className="mb-6"
        >
            <label
                htmlFor="product-search"
                className="mb-2 block font-semibold"
            >
                Search products
            </label>
            <div className="flex rounded-2xl border-2 border-store-primary bg-white p-1">
                <input
                    className="min-w-0 flex-1 border-0 px-3 text-base"
                    id="product-search"
                    name="search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                />
                <button
                    className="border-0 bg-store-primary px-5 text-white hover:bg-store-primary-hover"
                    type="submit"
                >
                    Search
                </button>
            </div>
        </form>
    );
}
