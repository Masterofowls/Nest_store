"use client";

import { useGetCategoriesQuery } from "@/shared/api/baseApi";

type FiltersProps = {
    categoryId: string;
    onCategoryChange: (categoryId: string) => void;
};

export default function Filters({
    categoryId,
    onCategoryChange,
}: FiltersProps) {
    const {
        data: categories,
        isLoading,
        isError,
        refetch,
    } = useGetCategoriesQuery();

    return (
        <fieldset className="mb-6 rounded-2xl bg-store-surface p-4">
            <legend className="text-lg font-semibold">Filters</legend>
            <label className="mr-3 font-medium" htmlFor="category-filter">
                Category
            </label>
            <select
                id="category-filter"
                name="categoryId"
                value={categoryId}
                disabled={isLoading || isError}
                onChange={(event) =>
                    onCategoryChange(event.currentTarget.value)
                }
            >
                <option value="">All categories</option>
                {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                        {category.name}
                    </option>
                ))}
            </select>
            {isError && (
                <p role="alert">
                    Couldn't load categories.{" "}
                    <button type="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </p>
            )}
        </fieldset>
    );
}
