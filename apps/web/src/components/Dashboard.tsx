"use client";

import { useState } from "react";
import ProductList from "./ProductList";
import Search from "./Search";

export default function Dashboard() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    function handleSearch(nextSearch: string) {
        setSearch(nextSearch);
        setPage(1);
    }

    return (
        <section aria-labelledby="dashboard-heading">
            <h1 id="dashboard-heading" className="mb-5">
                Dashboard
            </h1>
            <Search onSearch={handleSearch} />
            <ProductList page={page} search={search} onPageChange={setPage} />
        </section>
    );
}
