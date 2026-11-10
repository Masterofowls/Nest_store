"use client";

import { type FormEvent, useId, useState } from "react";
import { useGetCategoriesQuery } from "@/shared/api/baseApi";
import { groupCategories } from "./CatalogMenu";

export type CatalogFilters = {
    categoryId: string;
    minPrice: string;
    maxPrice: string;
    discounted: boolean;
    inStock: boolean;
};

type FiltersProps = {
    filters: CatalogFilters;
    onChange: (changes: Partial<CatalogFilters>) => void;
};

const pricePattern = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;

export default function Filters({ filters, onChange }: FiltersProps) {
    const {
        data: categories,
        isLoading,
        isError,
        refetch,
    } = useGetCategoriesQuery();
    const groups = groupCategories(categories);
    const [minPrice, setMinPrice] = useState(filters.minPrice);
    const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
    const [priceError, setPriceError] = useState("");
    const priceErrorId = useId();

    function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const min = minPrice.trim();
        const max = maxPrice.trim();
        if (
            (min && !pricePattern.test(min)) ||
            (max && !pricePattern.test(max))
        ) {
            setPriceError("Enter prices as numbers, for example 25 or 19.99.");
            return;
        }
        if (min && max && Number(min) > Number(max)) {
            setPriceError("The lowest price must not be above the highest.");
            return;
        }
        setPriceError("");
        onChange({ minPrice: min, maxPrice: max });
    }

    return (
        <div className="flex flex-col gap-5">
            <div>
                <label
                    className="mb-1.5 block font-semibold"
                    htmlFor="category-filter"
                >
                    Category
                </label>
                <select
                    className="w-full"
                    id="category-filter"
                    name="categoryId"
                    value={filters.categoryId}
                    disabled={isLoading || isError}
                    onChange={(event) =>
                        onChange({ categoryId: event.currentTarget.value })
                    }
                >
                    <option value="">All categories</option>
                    {groups.map((group) => [
                        <option key={group.id} value={group.id}>
                            {group.name}
                        </option>,
                        ...group.children.map((child) => (
                            <option key={child.id} value={child.id}>
                                {`  ${child.name}`}
                            </option>
                        )),
                    ])}
                </select>
                {isError && (
                    <p role="alert">
                        Couldn't load categories.{" "}
                        <button type="button" onClick={() => void refetch()}>
                            Retry
                        </button>
                    </p>
                )}
            </div>

            <form onSubmit={handlePriceSubmit} noValidate>
                <fieldset>
                    <legend className="mb-1.5 font-semibold">Price, $</legend>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-sm text-store-muted">
                            From
                            <input
                                className="mt-1 w-full"
                                name="minPrice"
                                inputMode="decimal"
                                value={minPrice}
                                aria-invalid={priceError ? true : undefined}
                                aria-describedby={
                                    priceError ? priceErrorId : undefined
                                }
                                onChange={(event) =>
                                    setMinPrice(event.currentTarget.value)
                                }
                            />
                        </label>
                        <label className="text-sm text-store-muted">
                            To
                            <input
                                className="mt-1 w-full"
                                name="maxPrice"
                                inputMode="decimal"
                                value={maxPrice}
                                aria-invalid={priceError ? true : undefined}
                                aria-describedby={
                                    priceError ? priceErrorId : undefined
                                }
                                onChange={(event) =>
                                    setMaxPrice(event.currentTarget.value)
                                }
                            />
                        </label>
                    </div>
                    {priceError && (
                        <p
                            id={priceErrorId}
                            className="mt-1 text-sm text-store-sale"
                            role="alert"
                        >
                            {priceError}
                        </p>
                    )}
                    <button className="mt-2 w-full" type="submit">
                        Apply price
                    </button>
                </fieldset>
            </form>

            <fieldset className="flex flex-col gap-1">
                <legend className="mb-1.5 font-semibold">Show</legend>
                <label className="flex min-h-11 items-center gap-2">
                    <input
                        className="size-5 accent-store-primary"
                        type="checkbox"
                        checked={filters.discounted}
                        onChange={(event) =>
                            onChange({
                                discounted: event.currentTarget.checked,
                            })
                        }
                    />
                    Discounted only
                </label>
                <label className="flex min-h-11 items-center gap-2">
                    <input
                        className="size-5 accent-store-primary"
                        type="checkbox"
                        checked={filters.inStock}
                        onChange={(event) =>
                            onChange({ inStock: event.currentTarget.checked })
                        }
                    />
                    In stock only
                </label>
            </fieldset>
        </div>
    );
}
