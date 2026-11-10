import { Suspense } from "react";
import type { Metadata } from "next";
import Catalog from "@/components/Catalog";

export const metadata: Metadata = { title: "Catalog" };

async function CatalogWithSearch({
    searchParams,
}: Pick<PageProps<"/catalog">, "searchParams">) {
    const { search } = await searchParams;
    const initialSearch = typeof search === "string" ? search.trim() : "";

    return <Catalog key={initialSearch} initialSearch={initialSearch} />;
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
