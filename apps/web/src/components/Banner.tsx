import Link from "next/link";
import { useId } from "react";
import { BackgroundGradient } from "./ui/background-gradient";

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
        <section aria-labelledby={headingId} className="my-8">
            <BackgroundGradient
                animate={false}
                className="rounded-3xl bg-store-surface p-6 sm:p-10"
            >
                <h2 id={headingId}>{title}</h2>
                <p className="mt-3 max-w-2xl text-store-muted">{description}</p>
                <Link
                    className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-store-primary px-5 font-semibold text-white hover:bg-store-primary-hover hover:text-white"
                    href={href}
                >
                    {actionLabel}
                </Link>
            </BackgroundGradient>
        </section>
    );
}
