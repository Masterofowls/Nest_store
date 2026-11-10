"use client";

import { useState, type FormEvent } from "react";
import {
    useDeleteBannerMutation,
    useManagementBannersQuery,
    useSaveBannerMutation,
    type ManagedBanner,
} from "../api/management-api";

export default function AdminBanners() {
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState<ManagedBanner | null>(null);
    const [message, setMessage] = useState("");
    const query = useManagementBannersQuery(page);
    const [save, state] = useSaveBannerMutation();
    const [remove, removeState] = useDeleteBannerMutation();

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const optional = (name: string) =>
            String(data.get(name) ?? "").trim() || null;
        try {
            await save({
                id: editing?.id,
                input: {
                    title: String(data.get("title") ?? "").trim(),
                    description: optional("description"),
                    linkUrl: optional("linkUrl"),
                    imageUrl: optional("imageUrl"),
                    isActive: data.has("isActive"),
                    sortOrder: Number(data.get("sortOrder")),
                },
            }).unwrap();
            setEditing(null);
            form.reset();
            setMessage("Banner saved.");
        } catch {
            setMessage("Couldn't save the banner. Check the fields and URLs.");
        }
    }
    async function deleteItem(banner: ManagedBanner) {
        if (!window.confirm(`Delete banner ${banner.title}?`)) return;
        try {
            await remove(banner.id).unwrap();
            setMessage("Banner deleted.");
        } catch {
            setMessage("Couldn't delete the banner. Try again.");
        }
    }
    return (
        <section>
            <h2>Banners</h2>
            {query.isFetching && <output>Loading banners…</output>}
            {query.isError && (
                <p role="alert">
                    Couldn't load banners.{" "}
                    <button onClick={() => void query.refetch()}>Retry</button>
                </p>
            )}
            {query.currentData?.length === 0 && !query.isFetching && (
                <p>No banners yet.</p>
            )}
            <ul>
                {query.currentData?.map((banner) => (
                    <li key={banner.id}>
                        {banner.title} —{" "}
                        {banner.isActive ? "Active" : "Inactive"}{" "}
                        <button
                            type="button"
                            onClick={() => setEditing(banner)}
                        >
                            Edit
                        </button>{" "}
                        <button
                            type="button"
                            disabled={removeState.isLoading}
                            onClick={() => void deleteItem(banner)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            <nav aria-label="Banner pages">
                <button
                    disabled={page === 1 || query.isFetching}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>{" "}
                Page {page}{" "}
                <button
                    disabled={
                        query.isFetching ||
                        !query.currentData ||
                        query.currentData.length < 20
                    }
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </nav>
            <h3>{editing ? "Edit banner" : "Add banner"}</h3>
            <form
                key={editing?.id ?? "new"}
                onSubmit={(event) => void submit(event)}
            >
                <p>
                    <label>
                        Title{" "}
                        <input
                            name="title"
                            required
                            maxLength={120}
                            defaultValue={editing?.title}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Description{" "}
                        <textarea
                            name="description"
                            maxLength={500}
                            defaultValue={editing?.description ?? ""}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Link (site path or HTTP URL){" "}
                        <input
                            name="linkUrl"
                            maxLength={2000}
                            defaultValue={editing?.linkUrl ?? ""}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Image URL{" "}
                        <input
                            name="imageUrl"
                            type="url"
                            maxLength={2000}
                            defaultValue={editing?.imageUrl ?? ""}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Display order{" "}
                        <input
                            name="sortOrder"
                            type="number"
                            min="0"
                            max="10000"
                            required
                            defaultValue={editing?.sortOrder ?? 0}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        <input
                            name="isActive"
                            type="checkbox"
                            defaultChecked={editing?.isActive ?? true}
                        />{" "}
                        Active
                    </label>
                </p>
                <button disabled={state.isLoading}>
                    {state.isLoading ? "Saving…" : "Save banner"}
                </button>
                {editing && (
                    <button type="button" onClick={() => setEditing(null)}>
                        Cancel editing
                    </button>
                )}
            </form>
            {message && <output>{message}</output>}
        </section>
    );
}
