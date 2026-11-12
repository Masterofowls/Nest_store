"use client";

import {
    useAddCartItemMutation,
    useGetCartQuery,
    useGetCurrentUserQuery,
    useRemoveCartItemMutation,
    useUpdateCartItemMutation,
} from "@/shared/api/baseApi";

type TileCartControlProps = {
    productId: string;
    productName: string;
    stockQuantity: number;
};

const controlClass =
    "relative z-10 min-h-11 w-full rounded-control text-sm font-semibold";

export default function TileCartControl({
    productId,
    productName,
    stockQuantity,
}: TileCartControlProps) {
    const { data: user, isLoading: isLoadingUser } = useGetCurrentUserQuery();
    const cartQuery = useGetCartQuery(undefined, { skip: !user });
    const [addCartItem, addState] = useAddCartItemMutation();
    const [updateCartItem, updateState] = useUpdateCartItemMutation();
    const [removeCartItem, removeState] = useRemoveCartItemMutation();
    const cartItem = cartQuery.data?.items.find(
        (item) => item.productId === productId,
    );
    const isSaving =
        addState.isLoading || updateState.isLoading || removeState.isLoading;
    const failed =
        addState.isError || updateState.isError || removeState.isError;

    // The tile already says "Out of stock", so no disabled button repeats it.
    if (stockQuantity === 0) return null;
    // Signed-out visitors buy from the product page, which explains signing in
    // once instead of repeating a sign-in button on every tile.
    if (isLoadingUser || !user) return null;

    if (!cartItem) {
        return (
            <div className="relative z-10">
                <button
                    className={`${controlClass} bg-store-primary text-white hover:bg-store-primary-hover`}
                    type="button"
                    disabled={isSaving || cartQuery.isLoading}
                    aria-label={`Add ${productName} to cart`}
                    onClick={() => void addCartItem({ productId, quantity: 1 })}
                >
                    {addState.isLoading ? "Adding…" : "Add to cart"}
                </button>
                {failed && (
                    <p className="mt-1 text-xs text-store-sale" role="alert">
                        Couldn't update the cart. Try again.
                    </p>
                )}
            </div>
        );
    }

    const quantity = cartItem.quantity;
    return (
        <div className="relative z-10">
            <div className="flex min-h-11 items-center justify-between rounded-control bg-store-primary-soft">
                <button
                    className="min-h-11 min-w-11 bg-transparent px-0 text-lg text-store-primary hover:bg-store-border"
                    type="button"
                    disabled={isSaving}
                    aria-label={
                        quantity === 1
                            ? `Remove ${productName} from cart`
                            : `Remove one ${productName}`
                    }
                    onClick={() =>
                        void (quantity === 1
                            ? removeCartItem(cartItem.id)
                            : updateCartItem({
                                  id: cartItem.id,
                                  quantity: quantity - 1,
                              }))
                    }
                >
                    −
                </button>
                <output
                    className="text-sm font-semibold"
                    aria-live="polite"
                    aria-label={`${productName} in cart`}
                >
                    {quantity}
                </output>
                <button
                    className="min-h-11 min-w-11 bg-transparent px-0 text-lg text-store-primary hover:bg-store-border"
                    type="button"
                    disabled={isSaving || quantity >= stockQuantity}
                    aria-label={`Add one more ${productName}`}
                    onClick={() =>
                        void updateCartItem({
                            id: cartItem.id,
                            quantity: quantity + 1,
                        })
                    }
                >
                    +
                </button>
            </div>
            {failed && (
                <p className="mt-1 text-xs text-store-sale" role="alert">
                    Couldn't update the cart. Try again.
                </p>
            )}
        </div>
    );
}
