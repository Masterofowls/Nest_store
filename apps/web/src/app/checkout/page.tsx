import type { Metadata } from "next";
import Checkout from "@/components/Checkout";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
    return (
        <main>
            <Checkout />
        </main>
    );
}
