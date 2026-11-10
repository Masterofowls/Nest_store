"use client";

import Image from "next/image";
import Link from "next/link";
import { usePublicBannersQuery } from "../api/management-api";

export default function PublicBanners() {
    const query = usePublicBannersQuery();
    if (query.isLoading) return <output>Loading banners…</output>;
    if (query.isError)
        return (
            <p role="alert">
                Couldn't load banners.{" "}
                <button onClick={() => void query.refetch()}>Retry</button>
            </p>
        );
    return query.data?.map((banner) => (
        <section
            key={banner.id}
            className="my-6 overflow-hidden rounded-3xl bg-store-surface p-6 sm:p-8"
        >
            <h2>{banner.title}</h2>
            {banner.imageUrl && (
                <Image
                    src={banner.imageUrl}
                    alt=""
                    width={640}
                    height={320}
                    unoptimized
                    className="my-4 h-auto max-w-full rounded-2xl"
                />
            )}
            {banner.description && <p>{banner.description}</p>}
            {banner.linkUrl && (
                <Link href={banner.linkUrl}>View {banner.title}</Link>
            )}
        </section>
    ));
}
