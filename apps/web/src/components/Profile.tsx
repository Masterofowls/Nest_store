"use client";

import Link from "next/link";
import { useGetCurrentUserQuery } from "@/shared/api/baseApi";
import User from "./User";
import ViewHistory from "./ViewHistory";

export default function Profile() {
    const {
        data: user,
        isLoading,
        isError,
        refetch,
    } = useGetCurrentUserQuery();

    return (
        <section aria-labelledby="profile-heading">
            <h1 id="profile-heading">Profile</h1>
            {isLoading ? (
                <output>Loading profile…</output>
            ) : isError ? (
                <p role="alert">
                    Couldn't load your profile.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            ) : user ? (
                <>
                    <User user={user} />
                    <nav aria-label="Account pages">
                        <ul className="my-4 flex flex-wrap gap-6">
                            <li>
                                <Link href="/orders">Orders</Link>
                            </li>
                            <li>
                                <Link href="/favourites">Favourites</Link>
                            </li>
                        </ul>
                    </nav>
                    <ViewHistory />
                </>
            ) : (
                <p>
                    <Link href="/login">Sign in</Link> to see your profile.
                </p>
            )}
        </section>
    );
}
