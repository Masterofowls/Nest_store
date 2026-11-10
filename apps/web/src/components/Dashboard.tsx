"use client";

import HomeShelves from "./HomeShelves";
import ProductList from "./ProductList";

export default function Dashboard() {
    return (
        <section aria-labelledby="dashboard-heading">
            <h1 id="dashboard-heading" className="sr-only">
                Online Store
            </h1>
            <HomeShelves />
            <ProductList title="All products" />
        </section>
    );
}
