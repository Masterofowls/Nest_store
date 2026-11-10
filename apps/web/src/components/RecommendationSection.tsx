"use client";

import { useGetProductRecommendationsQuery } from "@/shared/api/baseApi";
import Card from "./Card";

type RecommendationSectionProps = {
    productId: string;
};

export default function RecommendationSection({
    productId,
}: RecommendationSectionProps) {
    const {
        data: recommendations,
        isLoading,
        isError,
        refetch,
    } = useGetProductRecommendationsQuery(productId);

    return (
        <section aria-labelledby="recommendations-heading" className="mt-10">
            <h2 id="recommendations-heading">Customers also viewed</h2>
            {isLoading ? (
                <output>Loading recommendations…</output>
            ) : isError ? (
                <p role="alert">
                    Couldn't load recommendations.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            ) : recommendations && recommendations.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {recommendations.map((product) => (
                        <li className="min-w-0" key={product.id}>
                            <Card product={product} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No recommendations yet.</p>
            )}
        </section>
    );
}
