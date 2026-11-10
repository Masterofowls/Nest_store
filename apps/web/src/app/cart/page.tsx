import type { Metadata } from "next";
import Cart from "@/components/Cart";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
    return (
        <main>
            <Cart />
        </main>
    );
}
