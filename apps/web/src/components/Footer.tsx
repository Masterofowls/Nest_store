import Link from "next/link";

export default function Footer() {
    return (
        <footer className="mt-12 border-t border-store-border bg-store-surface">
            <nav
                aria-label="Footer"
                className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8"
            >
                <ul className="flex flex-wrap gap-6 font-semibold">
                    <li>
                        <Link href="/catalog">Catalog</Link>
                    </li>
                    <li>
                        <Link href="/profile">Profile</Link>
                    </li>
                </ul>
            </nav>
            <p className="mx-auto max-w-[1440px] px-4 py-6 text-sm text-store-muted sm:px-6 lg:px-8">
                Online Store, a Next.js and NestJS learning project.
            </p>
        </footer>
    );
}
