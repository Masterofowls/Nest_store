"use client";

import Link from "next/link";
import { useGetCategoriesQuery } from "@/shared/api/baseApi";
import { categoryHref, groupCategories } from "./CatalogMenu";

export default function CategoryChips() {
    const { data: categories } = useGetCategoriesQuery();
    const groups = groupCategories(categories);
    if (groups.length === 0) return null;

    return (
        <nav
            aria-label="Categories"
            className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8"
        >
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {groups.map((group) => (
                    <li key={group.id} className="shrink-0">
                        <Link
                            className="inline-flex min-h-11 items-center rounded-control border border-store-border px-4 text-sm font-medium whitespace-nowrap text-store-ink hover:border-store-ink hover:text-store-ink"
                            href={categoryHref(group.id)}
                        >
                            {group.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
