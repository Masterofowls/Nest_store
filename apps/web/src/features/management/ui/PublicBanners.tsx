"use client";

import Image from "next/image";
import Link from "next/link";
import { usePublicBannersQuery } from "../api/management-api";

export default function PublicBanners() {
    const query = usePublicBannersQuery();
    if (query.isLoading)
        return (
            <output className="mb-6 block aspect-[3/1] max-h-72 w-full rounded-panel bg-store-tile p-6 text-store-muted sm:aspect-[4/1]">
                Loading banners…
            </output>
        );
    if (query.isError)
        return (
            <p role="alert" className="mb-6">
                Couldn't load banners.{" "}
                <button onClick={() => void query.refetch()}>Retry</button>
            </p>
        );
    if (!query.data || query.data.length === 0) return null;

    return (
        <section aria-label="Promotions" className="mb-8">
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {query.data.map((banner) => (
                    <li
                        key={banner.id}
                        className={`relative flex min-h-48 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-panel bg-store-primary p-5 text-white sm:min-h-64 sm:p-8 ${query.data.length > 1 ? "w-[85%] md:w-[48%]" : "w-full"}`}
                    >
                        {banner.imageUrl && (
                            <Image
                                src={banner.imageUrl}
                                alt=""
                                fill
                                sizes="(max-width: 768px) 85vw, 50vw"
                                unoptimized
                                className="object-cover"
                            />
                        )}
                        <div
                            className={`relative max-w-md ${banner.imageUrl ? "rounded-tile bg-store-ink/75 p-4" : ""}`}
                        >
                            <h2 className="text-white">{banner.title}</h2>
                            {banner.description && (
                                <p className="mt-1">{banner.description}</p>
                            )}
                            {banner.linkUrl && (
                                <Link
                                    className="mt-3 inline-flex min-h-11 items-center rounded-tile bg-white px-4 font-semibold text-store-ink hover:text-store-primary"
                                    href={banner.linkUrl}
                                >
                                    View {banner.title}
                                </Link>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
