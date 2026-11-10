"use client";

import { useState } from "react";
import ProductList from "./ProductList";

export default function Dashboard() {
    const [page, setPage] = useState(1);

    return (
        <section aria-labelledby="dashboard-heading">
            <h1 id="dashboard-heading" className="sr-only">
                Online Store
            </h1>
            <ProductList page={page} search="" onPageChange={setPage} />
        </section>
    );
}
