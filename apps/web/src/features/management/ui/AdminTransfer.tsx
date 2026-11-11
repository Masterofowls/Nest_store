"use client";

import { useState, type FormEvent } from "react";
import { useImportCsvMutation } from "../api/management-api";

export default function AdminTransfer({
    mode = "admin",
}: {
    mode?: "admin" | "seller";
}) {
    const [resource, setResource] = useState<"products" | "users">("products");
    const [message, setMessage] = useState("");
    const [importCsv, state] = useImportCsvMutation();
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("file");
        const file =
            input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (!file || file.size === 0 || file.size > 90000) {
            setMessage("Choose a CSV file no larger than 90 KB.");
            return;
        }
        try {
            const result = await importCsv({
                resource,
                csv: await file.text(),
                role: mode,
            }).unwrap();
            setMessage(
                `Imported ${result.created}. ${result.skipped?.map((row) => `Row ${row.row}: ${row.message}`).join(" ") ?? ""}`,
            );
            form.reset();
        } catch {
            setMessage(
                resource === "users"
                    ? "Import failed. Some users may have been created; check the user list before retrying."
                    : "Import failed. Check the CSV columns and row values, then try again.",
            );
        } finally {
            state.reset();
        }
    }
    return (
        <section className="my-4">
            <h2>Import and export</h2>
            <h3>Import CSV</h3>
            <p>
                Products: name, categoryId, {mode === "admin" && "sellerId, "}
                price, stockQuantity; optional description, discountPercent.
            </p>
            {mode === "admin" && (
                <p>
                    Users: name, email, password; optional isAdmin. Existing
                    emails are skipped.
                </p>
            )}
            <form
                className="my-4 flex flex-wrap items-end gap-3 rounded-panel bg-store-surface p-4"
                onSubmit={(event) => void submit(event)}
            >
                {mode === "admin" && (
                    <label>
                        Import type{" "}
                        <select
                            value={resource}
                            onChange={(event) =>
                                setResource(
                                    event.target.value === "users"
                                        ? "users"
                                        : "products",
                                )
                            }
                        >
                            <option value="products">Products</option>
                            <option value="users">Users</option>
                        </select>
                    </label>
                )}{" "}
                <label>
                    CSV file{" "}
                    <input
                        className="max-w-full"
                        type="file"
                        name="file"
                        accept=".csv,text/csv"
                        required
                    />
                </label>{" "}
                <button
                    className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                    disabled={state.isLoading}
                >
                    {state.isLoading ? "Importing…" : "Import"}
                </button>
            </form>
            {message && <output>{message}</output>}
            {mode === "admin" && (
                <>
                    <h3>Export</h3>
                    <p>
                        Exports contain up to 10,000 rows per resource. Keep
                        downloaded user data private.
                    </p>
                    <ul>
                        {[
                            "products",
                            "categories",
                            "users",
                            "orders",
                            "banners",
                        ].map((item) => (
                            <li key={item}>
                                {item}:{" "}
                                <a
                                    href={`/backend/admin/export/${item}?format=json`}
                                >
                                    JSON
                                </a>{" "}
                                <a
                                    href={`/backend/admin/export/${item}?format=csv`}
                                >
                                    CSV
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <h3>Backup</h3>
            <p>
                {mode === "seller"
                    ? "Downloads your store profile, products, categories and image links. Image files are not included."
                    : "Downloads store data, including image links. Authentication credentials and image files are not included."}{" "}
                This export cannot restore the database.
            </p>
            <a
                className="inline-flex min-h-11 items-center rounded-control border border-store-border bg-store-surface px-4 font-semibold"
                href={`/backend/${mode}/export/backup`}
                download
            >
                Download JSON backup
            </a>
        </section>
    );
}
