import { Suspense } from "react";
import type { Metadata } from "next";
import { z } from "zod";
import Catalog from "@/components/Catalog";
import {
    parseAttributeSelection,
    parseBrandIds,
} from "@/features/catalog/model/facetParams";

export const metadata: Metadata = { title: "Catalog" };

function readParam(value: string | string[] | undefined) {
    return typeof value === "string" ? value.trim() : "";
}

async function CatalogWithSearch({
    searchParams,
}: Pick<PageProps<"/catalog">, "searchParams">) {
    const params = await searchParams;
    const initialSearch = readParam(params.search);
    const category = readParam(params.category);
    const initialCategoryId = z.uuid().safeParse(category).success
        ? category
        : "";

    const brands = readParam(params.brands);
    const attrs = readParam(params.attrs);

    return (
        <Catalog
            key={`${initialSearch}|${initialCategoryId}|${brands}|${attrs}`}
            initialSearch={initialSearch}
            initialCategoryId={initialCategoryId}
            initialBrandIds={parseBrandIds(brands)}
            initialAttributes={parseAttributeSelection(attrs)}
        />
    );
}

export default function CatalogPage({ searchParams }: PageProps<"/catalog">) {
    return (
        <main>
            <Suspense fallback={<output>Loading catalog…</output>}>
                <CatalogWithSearch searchParams={searchParams} />
            </Suspense>
        </main>
    );
}
