"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type CanonicalProductAddressProps = {
    // What the address bar holds: an id, the current slug, or an old slug.
    reference: string;
    slug: string | undefined;
};

// Moves id and renamed-product addresses to the current slug, keeping one
// address per product for sharing and search engines.
export default function CanonicalProductAddress({
    reference,
    slug,
}: CanonicalProductAddressProps) {
    const router = useRouter();

    useEffect(() => {
        if (slug && reference !== slug) {
            router.replace(
                `/products/${slug}${window.location.search}${window.location.hash}`,
                { scroll: false },
            );
        }
    }, [reference, router, slug]);

    return null;
}
