"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useGetProductsQuery } from "@/shared/api/baseApi";
import { SearchIcon } from "./StoreIcons";

const suggestionDelayMs = 250;
const minimumQueryLength = 2;

export default function HeaderSearch() {
    const router = useRouter();
    const listId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState("");
    const [debounced, setDebounced] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebounced(value.trim()),
            suggestionDelayMs,
        );
        return () => clearTimeout(timer);
    }, [value]);

    const { currentData: suggestions = [] } = useGetProductsQuery(
        { search: debounced, limit: 6, page: 1 },
        { skip: debounced.length < minimumQueryLength },
    );
    const showList =
        isOpen &&
        debounced.length >= minimumQueryLength &&
        suggestions.length > 0;

    useEffect(() => {
        if (!isOpen) return;
        function handlePointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("pointerdown", handlePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown);
    }, [isOpen]);

    function openProduct(productId: string) {
        setIsOpen(false);
        setActiveIndex(-1);
        router.push(`/products/${productId}`);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
            return;
        }
        if (!showList) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) =>
                index <= 0 ? suggestions.length - 1 : index - 1,
            );
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const product = suggestions[activeIndex];
            if (product) openProduct(product.id);
        }
    }

    return (
        <search className="flex min-w-0 flex-1">
            <div ref={containerRef} className="relative flex min-w-0 flex-1">
                <form
                    action="/catalog"
                    method="get"
                    className="flex min-w-0 flex-1 rounded-tile border-2 border-store-primary bg-store-surface"
                    onSubmit={() => setIsOpen(false)}
                >
                    <label htmlFor="site-search" className="sr-only">
                        Search the store
                    </label>
                    <input
                        className="min-h-10 min-w-0 flex-1 rounded-tile border-0 bg-transparent px-3 text-base focus-visible:outline-offset-0"
                        id="site-search"
                        name="search"
                        type="search"
                        role="combobox"
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-expanded={showList}
                        aria-controls={listId}
                        aria-activedescendant={
                            showList && activeIndex >= 0
                                ? `${listId}-${activeIndex}`
                                : undefined
                        }
                        placeholder="Search by product name"
                        value={value}
                        onChange={(event) => {
                            setValue(event.currentTarget.value);
                            setIsOpen(true);
                            setActiveIndex(-1);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className="m-0.5 min-h-10 min-w-11 rounded-[calc(var(--radius-tile)-2px)] bg-store-primary px-3 text-white hover:bg-store-primary-hover"
                        type="submit"
                    >
                        <SearchIcon className="size-5" />
                        <span className="sr-only">Find</span>
                    </button>
                </form>
                {/* ARIA combobox pattern: a native datalist cannot link to product pages. */}
                <div
                    id={listId}
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                    role="listbox"
                    aria-label="Product suggestions"
                    hidden={!showList}
                    className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-tile border border-store-border bg-store-surface py-1 shadow-lg"
                >
                    {suggestions.map((product, index) => (
                        // Arrow keys and Enter are handled on the combobox input.
                        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
                        <div
                            key={product.id}
                            id={`${listId}-${index}`}
                            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                            role="option"
                            tabIndex={-1}
                            aria-selected={index === activeIndex}
                            className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm ${index === activeIndex ? "bg-store-primary-soft text-store-primary" : "hover:bg-store-tile"}`}
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => openProduct(product.id)}
                        >
                            <SearchIcon className="size-4 shrink-0 text-store-muted" />
                            <span className="truncate">{product.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </search>
    );
}
