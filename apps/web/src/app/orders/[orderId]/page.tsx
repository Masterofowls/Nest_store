import { Suspense } from "react";
import type { Metadata } from "next";
import OrderDetail from "@/components/OrderDetail";

export const metadata: Metadata = { title: "Order details" };
export const instant = false;

async function OrderDetailPageContent({
    params,
}: {
    params: Promise<{ orderId: string }>;
}) {
    const { orderId } = await params;
    return <OrderDetail orderId={orderId} />;
}

export default function OrderDetailPage({
    params,
}: {
    params: Promise<{ orderId: string }>;
}) {
    return (
        <main>
            <Suspense
                fallback={
                    <output aria-busy="true">Loading order details…</output>
                }
            >
                <OrderDetailPageContent params={params} />
            </Suspense>
        </main>
    );
}
