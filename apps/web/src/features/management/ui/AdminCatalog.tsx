"use client";

import { useState, type FormEvent } from "react";
import {
    useDeleteCategoryMutation,
    useManagementCategoriesQuery,
    useSaveCategoryMutation,
} from "../api/management-api";
import Products from "./Products";

export default function AdminCatalog() {
    const [page, setPage] = useState(1);
    const categories = useManagementCategoriesQuery(page);
    const [save, saveState] = useSaveCategoryMutation();
    const [remove, removeState] = useDeleteCategoryMutation();
    const [editing, setEditing] = useState<{ id: string; name: string } | null>(
        null,
    );
    const [message, setMessage] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const name = String(new FormData(form).get("name") ?? "").trim();
        try {
            await save({ id: editing?.id, name }).unwrap();
            setEditing(null);
            form.reset();
            setMessage("Category saved.");
        } catch {
            setMessage(
                "Couldn't save the category. Check the name and try again.",
            );
        }
    }

    async function deleteItem(id: string, name: string) {
        if (!window.confirm(`Delete category ${name}?`)) return;
        try {
            await remove(id).unwrap();
            setMessage("Category deleted.");
        } catch {
            setMessage(
                "Couldn't delete the category. It may still have products.",
            );
        }
    }

    return (
        <>
            <Products mode="admin" />
            <section>
                <h2>Categories</h2>
                {categories.isLoading && <output>Loading categories…</output>}
                {categories.isError && (
                    <p role="alert">
                        Couldn't load categories.{" "}
                        <button onClick={() => void categories.refetch()}>
                            Retry
                        </button>
                    </p>
                )}
                {categories.currentData?.length === 0 && (
                    <p>No categories found on this page.</p>
                )}
                <ul>
                    {categories.currentData?.map((category) => (
                        <li key={category.id}>
                            {category.name} ({category.id}){" "}
                            <button
                                type="button"
                                onClick={() => setEditing(category)}
                            >
                                Edit
                            </button>{" "}
                            <button
                                type="button"
                                disabled={removeState.isLoading}
                                onClick={() =>
                                    void deleteItem(category.id, category.name)
                                }
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
                <nav aria-label="Category pages">
                    <button
                        disabled={page === 1 || categories.isFetching}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </button>{" "}
                    Page {page}{" "}
                    <button
                        disabled={
                            categories.isFetching ||
                            !categories.currentData ||
                            categories.currentData.length < 20
                        }
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </button>
                </nav>
                <form
                    key={editing?.id ?? "new"}
                    onSubmit={(event) => void submit(event)}
                >
                    <label>
                        {editing ? "Rename category" : "New category"}{" "}
                        <input
                            name="name"
                            required
                            maxLength={200}
                            defaultValue={editing?.name}
                        />
                    </label>{" "}
                    <button disabled={saveState.isLoading}>
                        Save category
                    </button>
                    {editing && (
                        <button type="button" onClick={() => setEditing(null)}>
                            Cancel editing
                        </button>
                    )}
                </form>
                {message && <output>{message}</output>}
            </section>
        </>
    );
}
