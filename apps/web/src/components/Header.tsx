"use client";

import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
    useGetCurrentUserQuery,
    useSignOutMutation,
} from "@/shared/api/baseApi";
import {
    BoxIcon,
    CartIcon,
    GridIcon,
    HeartIcon,
    SearchIcon,
    UserIcon,
} from "./StoreIcons";

type ShortcutLinkProps = {
    href: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    children: ReactNode;
};

function ShortcutLink({ href, icon: Icon, children }: ShortcutLinkProps) {
    return (
        <Link
            className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-tile px-1.5 text-store-ink hover:text-store-primary sm:px-2"
            href={href}
        >
            <Icon className="size-6" />
            <span className="max-w-20 truncate">{children}</span>
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

    return (
        <header className="z-30 border-b border-store-border bg-store-surface sm:sticky sm:top-0">
            <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_auto_1fr_auto] lg:gap-x-4 lg:px-8">
                <Link
                    className="text-xl font-extrabold tracking-tight text-store-primary hover:text-store-primary-hover sm:text-2xl"
                    href="/"
                >
                    Online Store
                </Link>

                <div className="col-span-2 row-start-2 flex items-stretch gap-2 lg:col-start-2 lg:row-start-1">
                    <Link
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-tile bg-store-primary px-4 font-semibold text-white hover:bg-store-primary-hover hover:text-white"
                        href="/catalog"
                    >
                        <GridIcon className="size-5" />
                        <span className="sr-only sm:not-sr-only">Catalog</span>
                    </Link>
                    <search className="flex min-w-0 flex-1">
                        <form
                            action="/catalog"
                            method="get"
                            className="flex min-w-0 flex-1 rounded-tile border-2 border-store-primary bg-store-surface"
                        >
                            <label htmlFor="site-search" className="sr-only">
                                Search the store
                            </label>
                            <input
                                className="min-h-10 min-w-0 flex-1 rounded-tile border-0 bg-transparent px-3 text-base focus-visible:outline-offset-0"
                                id="site-search"
                                name="search"
                                type="search"
                                placeholder="Search by product name"
                            />
                            <button
                                className="m-0.5 min-h-10 min-w-11 rounded-[calc(var(--radius-tile)-2px)] bg-store-primary px-3 text-white hover:bg-store-primary-hover"
                                type="submit"
                            >
                                <SearchIcon className="size-5" />
                                <span className="sr-only">Find</span>
                            </button>
                        </form>
                    </search>
                </div>

                <nav
                    aria-label="Shortcuts"
                    className="col-start-2 row-start-1 justify-self-end lg:col-start-4"
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
                                    >
                                        Favourites
                                    </ShortcutLink>
                                </li>
                                <li>
                                    <ShortcutLink href="/cart" icon={CartIcon}>
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
