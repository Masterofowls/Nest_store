"use client";

import Link from "next/link";
import {
    useGetCurrentUserQuery,
    useSignOutMutation,
} from "@/shared/api/baseApi";

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
            <nav
                aria-label="Main"
                className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8"
            >
                <Link
                    className="mr-3 text-xl font-black tracking-tight text-store-primary sm:text-2xl"
                    href="/"
                >
                    Online Store
                </Link>
                <ul className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <li>
                        <Link
                            className="inline-flex min-h-11 items-center rounded-xl bg-store-primary px-5 text-white hover:bg-store-primary-hover hover:text-white"
                            href="/catalog"
                        >
                            Catalog
                        </Link>
                    </li>
                    {user ? (
                        <>
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center px-2"
                                    href="/cart"
                                >
                                    Cart
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center px-2"
                                    href="/favourites"
                                >
                                    Favourites
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center px-2"
                                    href="/orders"
                                >
                                    Orders
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center px-2"
                                    href="/profile"
                                >
                                    {user.name}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="inline-flex min-h-11 items-center px-2"
                                    href="/seller"
                                >
                                    Seller CMS
                                </Link>
                            </li>
                            {user.isAdmin && (
                                <li>
                                    <Link
                                        className="inline-flex min-h-11 items-center px-2"
                                        href="/admin"
                                    >
                                        Admin
                                    </Link>
                                </li>
                            )}
                            <li>
                                <button
                                    type="button"
                                    disabled={isSigningOut}
                                    onClick={() => void signOut()}
                                >
                                    {isSigningOut ? "Signing out…" : "Sign out"}
                                </button>
                            </li>
                        </>
                    ) : (
                        !isLoading && (
                            <>
                                <li>
                                    <Link
                                        className="inline-flex min-h-11 items-center px-2"
                                        href="/login"
                                    >
                                        Sign in
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        className="inline-flex min-h-11 items-center px-2"
                                        href="/signup"
                                    >
                                        Sign up
                                    </Link>
                                </li>
                            </>
                        )
                    )}
                </ul>
            </nav>
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
