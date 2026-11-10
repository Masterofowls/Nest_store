import type { Metadata } from "next";
import Favourites from "@/components/Favourites";

export const metadata: Metadata = { title: "Favourites" };

export default function FavouritesPage() {
    return (
        <main>
            <Favourites />
        </main>
    );
}
