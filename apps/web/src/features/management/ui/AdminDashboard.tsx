"use client";

import Link from "next/link";
import { useState } from "react";
import { useGetCurrentUserQuery } from "@/shared/api/baseApi";
import { useManagementStatsQuery } from "../api/management-api";
import AdminCatalog from "./AdminCatalog";
import AdminUsers from "./AdminUsers";
import AdminOrders from "./AdminOrders";
import AdminBanners from "./AdminBanners";
import AdminTransfer from "./AdminTransfer";

type Section =
    | "Overview"
    | "Catalog"
    | "Users"
    | "Orders"
    | "Banners"
    | "Import and export";
const sections: Section[] = [
    "Overview",
    "Catalog",
    "Users",
    "Orders",
    "Banners",
    "Import and export",
];

function Overview() {
    const query = useManagementStatsQuery();
    if (query.isLoading) return <output>Loading store overview…</output>;
    if (query.isError)
        return (
            <p role="alert">
                Couldn't load the overview.{" "}
                <button onClick={() => void query.refetch()}>Retry</button>
            </p>
        );
    const stats = query.data;
    return (
        stats && (
            <section>
                <h2>Store overview</h2>
                <dl>
                    <dt>Products</dt>
                    <dd>{stats.products}</dd>
                    <dt>Out of stock</dt>
                    <dd>{stats.outOfStockProducts}</dd>
                    <dt>Categories</dt>
                    <dd>{stats.categories}</dd>
                    <dt>Sellers</dt>
                    <dd>{stats.sellers}</dd>
                    <dt>Users</dt>
                    <dd>{stats.users}</dd>
                    <dt>Orders</dt>
                    <dd>{stats.orders}</dd>
                    <dt>Pending orders</dt>
                    <dd>{stats.pendingOrders}</dd>
                    <dt>Non-cancelled order total</dt>
                    <dd>{stats.revenue}</dd>
                </dl>
                <p>
                    Order totals do not indicate payment; the store does not
                    process payments.
                </p>
            </section>
        )
    );
}

export default function AdminDashboard() {
    const session = useGetCurrentUserQuery();
    const [section, setSection] = useState<Section>("Overview");
    if (session.isLoading)
        return (
            <main>
                <h1>Admin dashboard</h1>
                <output>Checking your session…</output>
            </main>
        );
    if (session.isError)
        return (
            <main>
                <h1>Admin dashboard</h1>
                <p role="alert">
                    Couldn't check your session.{" "}
                    <button onClick={() => void session.refetch()}>
                        Retry
                    </button>
                </p>
            </main>
        );
    if (!session.data)
        return (
            <main>
                <h1>Admin dashboard</h1>
                <p>
                    <Link href="/login">Sign in</Link> to continue.
                </p>
            </main>
        );
    if (!session.data.isAdmin)
        return (
            <main>
                <h1>Admin dashboard</h1>
                <p>Admin access is required.</p>
            </main>
        );
    return (
        <main>
            <h1>Admin dashboard</h1>
            <nav
                aria-label="Admin sections"
                className="my-6 flex flex-wrap gap-2"
            >
                {sections.map((item) => (
                    <button
                        className={
                            section === item
                                ? "border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                                : ""
                        }
                        key={item}
                        type="button"
                        aria-current={section === item ? "page" : undefined}
                        onClick={() => setSection(item)}
                    >
                        {item}
                    </button>
                ))}
            </nav>
            {section === "Overview" && <Overview />}
            {section === "Catalog" && <AdminCatalog />}
            {section === "Users" && <AdminUsers />}
            {section === "Orders" && <AdminOrders />}
            {section === "Banners" && <AdminBanners />}
            {section === "Import and export" && <AdminTransfer />}
        </main>
    );
}
