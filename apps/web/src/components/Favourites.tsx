"use client";

import Link from "next/link";
import {
    useGetCurrentUserQuery,
    useGetFavouritesQuery,
    useRemoveFavouriteMutation,
} from "@/shared/api/baseApi";
import Skeleton from "./Skeleton";

export default function Favourites() {
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const favouritesQuery = useGetFavouritesQuery(undefined, { skip: !user });
    const [removeFavourite, removeState] = useRemoveFavouriteMutation();

    if (isLoadingUser) return <Skeleton label="your session" />;
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in</Link> to view your favourites.
            </p>
        );

    return (
        <section aria-labelledby="favourites-heading">
            <h1 id="favourites-heading">Your favourites</h1>
            {favouritesQuery.isLoading ? <Skeleton label="favourites" /> : null}
            {favouritesQuery.isError && (
                <p role="alert">
                    Couldn't load your favourites.{" "}
                    <button
                        type="button"
                        onClick={() => void favouritesQuery.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {favouritesQuery.data?.length === 0 && (
                <p>You haven't saved any favourites.</p>
            )}
            {removeState.isError && (
                <p role="alert">Couldn't remove this favourite. Try again.</p>
            )}
            {favouritesQuery.data && favouritesQuery.data.length > 0 && (
                <ul className="grid gap-3">
                    {favouritesQuery.data.map((item) => (
                        <li
                            className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-store-surface p-4"
                            key={item.id}
                        >
                            {item.productId ? (
                                <Link href={`/products/${item.productId}`}>
                                    {item.productName}
                                </Link>
                            ) : (
                                <span>{item.productName}</span>
                            )}
                            <button
                                type="button"
                                disabled={removeState.isLoading}
                                onClick={() => void removeFavourite(item.id)}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
