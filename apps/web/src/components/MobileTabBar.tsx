"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useGetCurrentUserQuery } from "@/shared/api/baseApi";
import {
    CartIcon,
    GridIcon,
    HeartIcon,
    HomeIcon,
    UserIcon,
} from "./StoreIcons";
import { useShopCounts } from "./useShopCounts";

type Tab = {
    href: string;
    label: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    count?: number;
};

export default function MobileTabBar() {
    const pathname = usePathname();
    const { data: user } = useGetCurrentUserQuery();
    const { cartCount, favouriteCount } = useShopCounts();
    const tabs: Tab[] = [
        { href: "/", label: "Home", icon: HomeIcon },
        { href: "/catalog", label: "Catalog", icon: GridIcon },
        { href: "/cart", label: "Cart", icon: CartIcon, count: cartCount },
        {
            href: "/favourites",
            label: "Favourites",
            icon: HeartIcon,
            count: favouriteCount,
        },
        user
            ? { href: "/profile", label: "Profile", icon: UserIcon }
            : { href: "/login", label: "Sign in", icon: UserIcon },
    ];

    return (
        <nav
            aria-label="Quick navigation"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-store-border bg-store-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
            <ul className="grid grid-cols-5">
                {tabs.map(({ href, label, icon: Icon, count }) => {
                    const isCurrent =
                        href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(href);
                    return (
                        <li key={href}>
                            <Link
                                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${isCurrent ? "text-store-primary" : "text-store-muted"}`}
                                href={href}
                                aria-current={isCurrent ? "page" : undefined}
                            >
                                <Icon className="size-6" />
                                {label}
                                {count !== undefined && count > 0 && (
                                    <span className="absolute top-1 left-1/2 ml-1.5 min-w-5 rounded-full bg-store-ink px-1 text-center text-[0.6875rem] leading-5 font-bold text-white">
                                        {count}
                                        <span className="sr-only">
                                            {count === 1 ? " item" : " items"}
                                        </span>
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
