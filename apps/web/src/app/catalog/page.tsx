import type { Metadata } from "next";
import Catalog from "@/components/Catalog";

export const metadata: Metadata = { title: "Catalog" };

export default function CatalogPage() {
    return (
        <main>
            <Catalog />
        </main>
    );
}
