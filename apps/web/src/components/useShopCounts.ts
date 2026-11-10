"use client";

import {
    useGetCartQuery,
    useGetCurrentUserQuery,
    useGetFavouritesQuery,
} from "@/shared/api/baseApi";

export function useShopCounts() {
    const { data: user } = useGetCurrentUserQuery();
    const { data: cart } = useGetCartQuery(undefined, { skip: !user });
    const { data: favourites } = useGetFavouritesQuery(undefined, {
        skip: !user,
    });
    return {
        cartCount:
            cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
        favouriteCount: favourites?.length ?? 0,
    };
}
