import type { Metadata } from "next";
import Orders from "@/components/Orders";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
    return (
        <main>
            <Orders />
        </main>
    );
}
