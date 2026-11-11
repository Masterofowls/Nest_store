import type { Metadata } from "next";
import Compare from "@/features/compare/ui/Compare";

export const metadata: Metadata = { title: "Compare products" };

export default function ComparePage() {
    return (
        <main>
            <h1 className="mb-5">Compare products</h1>
            <Compare />
        </main>
    );
}
