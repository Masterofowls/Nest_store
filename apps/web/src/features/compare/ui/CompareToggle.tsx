"use client";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ScaleIcon } from "@/components/StoreIcons";
import {
    compareToggled,
    selectComparedIds,
    selectIsCompareFull,
} from "../model/compareSlice";

type CompareToggleProps = {
    productId: string;
    productName: string;
    variant?: "icon" | "button";
};

export default function CompareToggle({
    productId,
    productName,
    variant = "button",
}: CompareToggleProps) {
    const dispatch = useAppDispatch();
    const isCompared = useAppSelector(selectComparedIds).includes(productId);
    const isFull = useAppSelector(selectIsCompareFull);
    const label = isCompared
        ? `Remove ${productName} from comparison`
        : `Add ${productName} to comparison`;

    if (variant === "icon") {
        return (
            <button
                className={`absolute top-14 right-1.5 z-10 size-11 p-0 ${isCompared ? "bg-store-primary text-white hover:bg-store-primary-hover" : "bg-store-surface/85 text-store-ink hover:bg-store-surface hover:text-store-primary"}`}
                type="button"
                aria-pressed={isCompared}
                aria-label={label}
                title={
                    !isCompared && isFull
                        ? "The comparison already has four products"
                        : undefined
                }
                disabled={!isCompared && isFull}
                onClick={() => dispatch(compareToggled(productId))}
            >
                <ScaleIcon className="size-5" />
            </button>
        );
    }

    return (
        <div>
            <button
                className="w-full gap-2"
                type="button"
                aria-pressed={isCompared}
                aria-label={label}
                disabled={!isCompared && isFull}
                onClick={() => dispatch(compareToggled(productId))}
            >
                <ScaleIcon className="size-5" />
                {isCompared ? "In comparison" : "Compare"}
            </button>
            {!isCompared && isFull && (
                <p className="mt-1 text-sm text-store-muted">
                    The comparison already has four products. Remove one to add
                    this.
                </p>
            )}
        </div>
    );
}
