"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Category } from "@/entities/category/model/category.schema";
import { useGetCategoriesQuery } from "@/shared/api/baseApi";
import { GridIcon } from "./StoreIcons";

export function groupCategories(categories: Category[] = []) {
    const topLevel = categories.filter((category) => !category.parentId);
    return topLevel.map((parent) => ({
        ...parent,
        children: categories.filter((child) => child.parentId === parent.id),
    }));
}

export function categoryHref(categoryId: string) {
    return `/catalog?category=${encodeURIComponent(categoryId)}`;
}

export default function CatalogMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const {
        data: categories,
        isLoading,
        isError,
        refetch,
    } = useGetCategoriesQuery(undefined, { skip: !isOpen });
    const groups = groupCategories(categories);

    useEffect(() => {
        if (!isOpen) return;
        function handlePointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        }
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    function close() {
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} className="contents">
            <button
                ref={buttonRef}
                className="min-h-11 shrink-0 gap-2 rounded-tile bg-store-primary px-4 text-white hover:bg-store-primary-hover"
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setIsOpen((open) => !open)}
            >
                <GridIcon className="size-5" />
                <span className="sr-only sm:not-sr-only">Catalog</span>
            </button>
            <div
                id={panelId}
                hidden={!isOpen}
                className="absolute inset-x-0 top-full z-40 max-h-[70dvh] overflow-y-auto border-b border-store-border bg-store-surface shadow-lg"
            >
                <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
                    <Link
                        className="inline-flex min-h-11 items-center font-semibold"
                        href="/catalog"
                        onClick={close}
                    >
                        All products
                    </Link>
                    {isLoading && (
                        <output className="block">Loading categories…</output>
                    )}
                    {isError && (
                        <p role="alert">
                            Couldn't load categories.{" "}
                            <button
                                type="button"
                                onClick={() => void refetch()}
                            >
                                Retry
                            </button>
                        </p>
                    )}
                    {groups.length > 0 && (
                        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                            {groups.map((group) => (
                                <li key={group.id}>
                                    <Link
                                        className="inline-flex min-h-11 items-center font-semibold text-store-ink hover:text-store-primary"
                                        href={categoryHref(group.id)}
                                        onClick={close}
                                    >
                                        {group.name}
                                    </Link>
                                    {group.children.length > 0 && (
                                        <ul className="text-sm">
                                            {group.children.map((child) => (
                                                <li key={child.id}>
                                                    <Link
                                                        className="inline-flex min-h-11 items-center text-store-muted hover:text-store-primary sm:min-h-9"
                                                        href={categoryHref(
                                                            child.id,
                                                        )}
                                                        onClick={close}
                                                    >
                                                        {child.name}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
