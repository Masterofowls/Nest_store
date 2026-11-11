"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useGetCurrentUserQuery } from "@/shared/api/baseApi";
import {
    useOwnSellerQuery,
    useSaveSellerMutation,
} from "../api/management-api";
import Products from "./Products";
import AdminTransfer from "./AdminTransfer";

export default function SellerDashboard() {
    const session = useGetCurrentUserQuery();
    const seller = useOwnSellerQuery(undefined, { skip: !session.data });
    const [save, state] = useSaveSellerMutation();
    const [message, setMessage] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        try {
            await save({
                exists: Boolean(seller.data),
                storeName: String(values.get("storeName") ?? "").trim(),
                description:
                    String(values.get("description") ?? "").trim() || null,
            }).unwrap();
            setMessage("Store profile saved.");
        } catch {
            setMessage(
                "Couldn't save the store profile. Check the name and try again.",
            );
        }
    }

    if (session.isLoading)
        return (
            <main>
                <h1>Seller CMS</h1>
                <output>Checking your session…</output>
            </main>
        );
    if (session.isError)
        return (
            <main>
                <h1>Seller CMS</h1>
                <p role="alert">
                    Couldn't check your session.{" "}
                    <button onClick={() => void session.refetch()}>
                        Retry
                    </button>
                </p>
            </main>
        );
    if (!session.data)
        return (
            <main>
                <h1>Seller CMS</h1>
                <p>
                    <Link href="/login">Sign in</Link> to manage your store.
                </p>
            </main>
        );
    return (
        <main>
            <h1>Seller CMS</h1>
            {seller.isLoading && <output>Loading your store…</output>}
            {seller.isError && (
                <p role="alert">
                    Couldn't load your store.{" "}
                    <button onClick={() => void seller.refetch()}>Retry</button>
                </p>
            )}
            {seller.isSuccess && (
                <>
                    <section className="my-6 rounded-panel bg-store-surface p-5">
                        <h2>
                            {seller.data
                                ? "Store profile"
                                : "Create your store"}
                        </h2>
                        <form
                            key={seller.data?.id ?? "new"}
                            onSubmit={(event) => void submit(event)}
                        >
                            <p>
                                <label>
                                    Store name{" "}
                                    <input
                                        className="ml-2"
                                        name="storeName"
                                        required
                                        maxLength={200}
                                        defaultValue={seller.data?.storeName}
                                    />
                                </label>
                            </p>
                            <p>
                                <label>
                                    Description{" "}
                                    <textarea
                                        className="ml-2 max-w-full"
                                        name="description"
                                        maxLength={5000}
                                        defaultValue={
                                            seller.data?.description ?? ""
                                        }
                                    />
                                </label>
                            </p>
                            <button
                                className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                                disabled={state.isLoading}
                            >
                                {state.isLoading ? "Saving…" : "Save store"}
                            </button>
                        </form>
                        {message && <output>{message}</output>}
                    </section>
                    {seller.data && (
                        <>
                            <Products mode="seller" sellerId={seller.data.id} />
                            <AdminTransfer mode="seller" />
                        </>
                    )}
                </>
            )}
        </main>
    );
}
