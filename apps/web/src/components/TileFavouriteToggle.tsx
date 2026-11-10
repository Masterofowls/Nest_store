"use client";

import Link from "next/link";
import {
    useAddFavouriteMutation,
    useGetCurrentUserQuery,
    useGetFavouritesQuery,
    useRemoveFavouriteMutation,
} from "@/shared/api/baseApi";
import { HeartIcon } from "./StoreIcons";

type TileFavouriteToggleProps = {
    productId: string;
    productName: string;
};

const toggleClass =
    "absolute top-1.5 right-1.5 z-10 inline-flex size-11 items-center justify-center rounded-full bg-store-surface/85 p-0 text-store-ink hover:bg-store-surface hover:text-store-sale";

export default function TileFavouriteToggle({
    productId,
    productName,
}: TileFavouriteToggleProps) {
    const { data: user, isLoading } = useGetCurrentUserQuery();
    const favouritesQuery = useGetFavouritesQuery(undefined, { skip: !user });
    const [addFavourite, addState] = useAddFavouriteMutation();
    const [removeFavourite, removeState] = useRemoveFavouriteMutation();
    const favourite = favouritesQuery.data?.find(
        (item) => item.productId === productId,
    );

    if (isLoading) return null;
    if (!user) {
        return (
            <Link
                className={toggleClass}
                href="/login"
                aria-label={`Sign in to save ${productName}`}
            >
                <HeartIcon className="size-5" />
            </Link>
        );
    }

    return (
        <button
            className={`${toggleClass} ${favourite ? "text-store-sale" : ""}`}
            type="button"
            aria-pressed={Boolean(favourite)}
            aria-label={`Save ${productName} to favourites`}
            disabled={
                addState.isLoading ||
                removeState.isLoading ||
                favouritesQuery.isLoading
            }
            onClick={() =>
                void (favourite
                    ? removeFavourite(favourite.id)
                    : addFavourite({ productId }))
            }
        >
            <HeartIcon
                className="size-5"
                fill={favourite ? "currentColor" : "none"}
            />
        </button>
    );
}
