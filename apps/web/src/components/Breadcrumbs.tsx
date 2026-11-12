import Link from "next/link";
import type { Category } from "@/entities/category/model/category.schema";
import { categoryHref } from "./CatalogMenu";

export type Crumb = { label: string; href?: string };

// Home, catalog, then the category path from the top level down.
export function categoryCrumbs(
    categories: Category[] | undefined,
    categoryId: string | undefined,
): Crumb[] {
    const crumbs: Crumb[] = [];
    const seen = new Set<string>();
    let current = categories?.find((category) => category.id === categoryId);
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        crumbs.unshift({
            label: current.name,
            href: categoryHref(current.id),
        });
        const parentId = current.parentId;
        current = categories?.find((category) => category.id === parentId);
    }
    return [
        { label: "Home", href: "/" },
        { label: "Catalog", href: "/catalog" },
        ...crumbs,
    ];
}

type BreadcrumbsProps = {
    crumbs: Crumb[];
    // The page itself, shown last and not linked.
    current?: string;
};

export default function Breadcrumbs({ crumbs, current }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center text-sm text-store-muted">
                {crumbs.map((crumb, index) => (
                    <li
                        className="flex items-center"
                        key={crumb.href ?? crumb.label}
                    >
                        {index > 0 && (
                            <span aria-hidden="true" className="px-1.5">
                                /
                            </span>
                        )}
                        {crumb.href ? (
                            <Link
                                className="inline-flex min-h-11 items-center text-store-muted hover:text-store-primary"
                                href={crumb.href}
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            crumb.label
                        )}
                    </li>
                ))}
                {current && (
                    // On phones the heading right below already names the page.
                    <li className="hidden min-w-0 items-center sm:flex">
                        <span aria-hidden="true" className="px-1.5">
                            /
                        </span>
                        <span
                            aria-current="page"
                            className="truncate text-store-ink"
                        >
                            {current}
                        </span>
                    </li>
                )}
            </ol>
        </nav>
    );
}
