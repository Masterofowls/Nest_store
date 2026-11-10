"use client";

import { useGetProductReviewsQuery } from "@/shared/api/baseApi";
import { reviewCountLabel } from "./productLabels";
import { StarIcon } from "./StoreIcons";

type ProductReviewsProps = {
    productId: string;
    productName: string;
    averageRating?: number | null;
    ratingCount?: number;
};

const scores = [5, 4, 3, 2, 1] as const;

export default function ProductReviews({
    productId,
    productName,
    averageRating,
    ratingCount,
}: ProductReviewsProps) {
    const {
        data: reviews,
        isLoading,
        isError,
        refetch,
    } = useGetProductReviewsQuery(productId);
    const loaded = reviews?.length ?? 0;
    const total = ratingCount ?? loaded;
    const average =
        averageRating ??
        (loaded > 0 && reviews
            ? reviews.reduce((sum, review) => sum + review.score, 0) / loaded
            : null);

    return (
        <section
            id="reviews"
            className="mt-10 scroll-mt-40"
            aria-label={`Reviews for ${productName}`}
        >
            <h2 className="mb-4">Reviews</h2>
            {isLoading ? (
                <output>Loading reviews…</output>
            ) : isError ? (
                <p role="alert">
                    Couldn't load reviews.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            ) : !reviews || reviews.length === 0 ? (
                <p>No reviews yet.</p>
            ) : (
                <div className="grid gap-8 md:grid-cols-[18rem_1fr]">
                    <div>
                        {average !== null && (
                            <p className="flex items-center gap-2 text-3xl font-bold">
                                <StarIcon className="size-7 text-store-rating" />
                                {average.toFixed(1)}
                                <span className="text-base font-normal text-store-muted">
                                    out of 5
                                </span>
                            </p>
                        )}
                        <p className="mt-1 text-sm text-store-muted">
                            {reviewCountLabel(total)}
                        </p>
                        <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                            {scores.map((score) => {
                                const count = reviews.filter(
                                    (review) => review.score === score,
                                ).length;
                                return (
                                    <li
                                        key={score}
                                        className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2"
                                    >
                                        <span>
                                            {score === 1
                                                ? "1 star"
                                                : `${score} stars`}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className="h-2 overflow-hidden rounded-full bg-store-tile"
                                        >
                                            <span
                                                className="block h-full rounded-full bg-store-rating"
                                                style={{
                                                    width: `${(count / loaded) * 100}%`,
                                                }}
                                            />
                                        </span>
                                        <span className="text-right text-store-muted">
                                            {count}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        {total > loaded && (
                            <p className="mt-2 text-xs text-store-muted">
                                Breakdown of the latest {loaded} reviews.
                            </p>
                        )}
                    </div>
                    <ul className="flex flex-col divide-y divide-store-border">
                        {reviews.map((review) => (
                            <li key={review.id} className="py-4 first:pt-0">
                                <p className="flex items-center gap-1 font-semibold">
                                    <StarIcon className="size-4 text-store-rating" />
                                    Score: {review.score} out of 5
                                </p>
                                {review.comment !== null && (
                                    <p className="mt-1">{review.comment}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
