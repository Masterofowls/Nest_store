"use client";

import Link from "next/link";
import {
    useGetCurrentUserQuery,
    useGetFavouritesQuery,
    useAddFavouriteMutation,
    useRemoveFavouriteMutation,
} from "@/shared/api/baseApi";
import Skeleton from "./Skeleton";

type FavouriteButtonProps = { productId: string };

export default function FavouriteButton({ productId }: FavouriteButtonProps) {
    const {
        data: user,
        isLoading: isLoadingUser,
        isError: isUserError,
    } = useGetCurrentUserQuery();
    const favouritesQuery = useGetFavouritesQuery(undefined, { skip: !user });
    const [addFavourite, addState] = useAddFavouriteMutation();
    const [removeFavourite, removeState] = useRemoveFavouriteMutation();
    const favourite = favouritesQuery.data?.find(
        (item) => item.productId === productId,
    );
    const isSaving = addState.isLoading || removeState.isLoading;

    async function toggleFavourite() {
        if (favourite) {
            await removeFavourite(favourite.id);
        } else {
            await addFavourite({ productId });
        }
    }

    if (isLoadingUser || (user && favouritesQuery.isLoading)) {
        return <Skeleton label="favourites" lines={1} />;
    }
    if (isUserError) return <p role="alert">Couldn't check your session.</p>;
    if (!user)
        return (
            <p>
                <Link href="/login">Sign in to save favourites</Link>
            </p>
        );
    if (favouritesQuery.isError) {
        return <p role="alert">Couldn't load your favourites.</p>;
    }

    return (
        <div className="my-3">
            <button
                type="button"
                disabled={isSaving}
                onClick={() => void toggleFavourite()}
            >
                {favourite ? "Remove from favourites" : "Add to favourites"}
            </button>
            {addState.isError || removeState.isError ? (
                <p role="alert">Couldn't update your favourites. Try again.</p>
            ) : null}
        </div>
    );
}
