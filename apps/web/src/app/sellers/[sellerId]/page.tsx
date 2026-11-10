import { Suspense } from "react";
import type { Metadata } from "next";
import Seller from "@/components/Seller";

export const metadata: Metadata = { title: "Seller" };
export const instant = false;

async function SellerPageContent({
    params,
}: {
    params: Promise<{ sellerId: string }>;
}) {
    const { sellerId } = await params;
    return <Seller sellerId={sellerId} />;
}

export default function SellerPage({
    params,
}: {
    params: Promise<{ sellerId: string }>;
}) {
    return (
        <main>
            <Suspense
                fallback={<output aria-busy="true">Loading seller…</output>}
            >
                <SellerPageContent params={params} />
            </Suspense>
        </main>
    );
}
