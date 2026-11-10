"use client";

import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
    useGetCurrentUserQuery,
    useSignOutMutation,
} from "@/shared/api/baseApi";
import CatalogMenu from "./CatalogMenu";
import CategoryChips from "./CategoryChips";
import HeaderSearch from "./HeaderSearch";
import { BoxIcon, CartIcon, HeartIcon, UserIcon } from "./StoreIcons";
import { useShopCounts } from "./useShopCounts";

type ShortcutLinkProps = {
    href: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    count?: number;
    children: ReactNode;
};

function ShortcutLink({
    href,
    icon: Icon,
    count,
    children,
}: ShortcutLinkProps) {
    return (
        <Link
            className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-tile px-1.5 text-store-ink hover:text-store-primary sm:px-2"
            href={href}
        >
            <Icon className="size-6" />
            <span className="max-w-20 truncate">{children}</span>
            {count !== undefined && count > 0 && (
                <span className="absolute top-0 left-1/2 ml-1.5 min-w-5 rounded-full bg-store-sale px-1 text-center text-[0.6875rem] leading-5 font-bold text-white">
                    {count}
                    <span className="sr-only">
                        {count === 1 ? " item" : " items"}
                    </span>
                </span>
            )}
        </Link>
    );
}

export default function Header() {
    const {
        data: user,
        isLoading,
        isError,
        refetch,
    } = useGetCurrentUserQuery();
    const [signOut, { isLoading: isSigningOut, isError: isSignOutError }] =
        useSignOutMutation();
    const { cartCount, favouriteCount } = useShopCounts();

    return (
        <header className="relative z-30 border-b border-store-border bg-store-surface sm:sticky sm:top-0">
            <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_auto_1fr_auto] lg:gap-x-4 lg:px-8">
                <Link
                    className="text-xl font-extrabold tracking-tight text-store-primary hover:text-store-primary-hover sm:text-2xl"
                    href="/"
                >
                    Online Store
                </Link>

                <div className="col-span-2 row-start-2 flex items-stretch gap-2 lg:col-start-2 lg:row-start-1">
                    <CatalogMenu />
                    <HeaderSearch />
                </div>

                <nav
                    aria-label="Shortcuts"
                    className="col-start-2 row-start-1 hidden justify-self-end sm:block lg:col-start-4"
                >
                    <ul className="flex items-center gap-1 text-xs font-medium sm:gap-2">
                        {user ? (
                            <>
                                <li>
                                    <ShortcutLink href="/orders" icon={BoxIcon}>
                                        Orders
                                    </ShortcutLink>
                                </li>
                                <li>
                                    <ShortcutLink
                                        href="/favourites"
                                        icon={HeartIcon}
                                        count={favouriteCount}
                                    >
                                        Favourites
                                    </ShortcutLink>
                                </li>
                                <li>
                                    <ShortcutLink
                                        href="/cart"
                                        icon={CartIcon}
                                        count={cartCount}
                                    >
                                        Cart
                                    </ShortcutLink>
                                </li>
                                <li>
                                    <ShortcutLink
                                        href="/profile"
                                        icon={UserIcon}
                                    >
                                        {user.name}
                                    </ShortcutLink>
                                </li>
                            </>
                        ) : (
                            !isLoading && (
                                <li>
                                    <ShortcutLink href="/login" icon={UserIcon}>
                                        Sign in
                                    </ShortcutLink>
                                </li>
                            )
                        )}
                    </ul>
                </nav>
            </div>

            {(user || !isLoading) && (
                <nav
                    aria-label="Main"
                    className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8"
                >
                    <ul className="flex flex-wrap items-center gap-x-4 text-sm text-store-muted">
                        {user ? (
                            <>
                                <li>
                                    <Link
                                        className="inline-flex min-h-11 items-center text-store-muted hover:text-store-primary"
                                        href="/seller"
                                    >
                                        Seller CMS
                                    </Link>
                                </li>
                                {user.isAdmin && (
                                    <li>
                                        <Link
                                            className="inline-flex min-h-11 items-center text-store-muted hover:text-store-primary"
                                            href="/admin"
                                        >
                                            Admin
                                        </Link>
                                    </li>
                                )}
                                <li className="ml-auto">
                                    <button
                                        className="min-h-11 bg-transparent px-0 font-normal text-store-muted hover:bg-transparent hover:text-store-primary"
                                        type="button"
                                        disabled={isSigningOut}
                                        onClick={() => void signOut()}
                                    >
                                        {isSigningOut
                                            ? "Signing out…"
                                            : "Sign out"}
                                    </button>
                                </li>
                            </>
                        ) : (
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center text-store-muted hover:text-store-primary"
                                    href="/signup"
                                >
                                    Sign up
                                </Link>
                            </li>
                        )}
                    </ul>
                </nav>
            )}
            <CategoryChips />
            {isError && (
                <p
                    className="mx-auto max-w-[1440px] px-4 pb-3 text-red-700"
                    role="alert"
                >
                    Couldn't check your session.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {isSignOutError && (
                <p
                    className="mx-auto max-w-[1440px] px-4 pb-3 text-red-700"
                    role="alert"
                >
                    Couldn't sign out. Try again.
                </p>
            )}
        </header>
    );
}
