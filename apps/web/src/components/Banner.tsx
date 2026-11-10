import Link from "next/link";
import { useId } from "react";

type BannerProps = {
    title: string;
    description: string;
    href: string;
    actionLabel: string;
};

export default function Banner({
    title,
    description,
    href,
    actionLabel,
}: BannerProps) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="my-8 flex flex-col gap-4 rounded-panel bg-store-primary-soft p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
            <div>
                <h2 id={headingId}>{title}</h2>
                <p className="mt-2 max-w-2xl text-store-muted">{description}</p>
            </div>
            <Link
                className="inline-flex min-h-11 shrink-0 items-center self-start rounded-tile bg-store-primary px-5 font-semibold text-white hover:bg-store-primary-hover hover:text-white sm:self-center"
                href={href}
            >
                {actionLabel}
            </Link>
        </section>
    );
}
