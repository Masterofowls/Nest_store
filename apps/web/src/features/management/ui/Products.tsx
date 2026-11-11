"use client";

import { useState, type FormEvent } from "react";
import { useGetProductsQuery } from "@/shared/api/baseApi";
import {
    useDeleteProductMutation,
    useBulkProductsMutation,
    useSaveProductMutation,
    useUploadProductImageMutation,
    type ManagedProduct,
} from "../api/management-api";
import ProductImages from "./ProductImages";
import CategoryPicker from "./CategoryPicker";
import SellerPicker from "./SellerPicker";

export default function Products({
    mode,
    sellerId,
}: {
    mode: "admin" | "seller";
    sellerId?: string;
}) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState<ManagedProduct | null>(null);
    const [formKey, setFormKey] = useState(0);
    const {
        currentData: products,
        isFetching,
        isError,
        refetch,
    } = useGetProductsQuery({
        page,
        limit: 20,
        sellerId,
        search: search || undefined,
    });
    const [save, saveState] = useSaveProductMutation();
    const [upload, uploadState] = useUploadProductImageMutation();
    const [remove, removeState] = useDeleteProductMutation();
    const [message, setMessage] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [discount, setDiscount] = useState("0");
    const [bulk, bulkState] = useBulkProductsMutation();

    async function applyBulk(action: "delete" | "discount") {
        const value = Number(discount);
        if (
            action === "discount" &&
            (discount.trim() === "" ||
                !Number.isInteger(value) ||
                value < 0 ||
                value > 100)
        ) {
            setMessage("Enter a whole discount percentage from 0 to 100.");
            return;
        }
        if (
            action === "delete" &&
            !window.confirm(
                `Delete ${selected.length} selected products? This cannot be undone.`,
            )
        )
            return;
        try {
            const result = await bulk(
                action === "delete"
                    ? { role: mode, action, ids: selected }
                    : {
                          role: mode,
                          action,
                          ids: selected,
                          discountPercent: value,
                      },
            ).unwrap();
            if (action === "delete" && editing && selected.includes(editing.id))
                setEditing(null);
            setSelected([]);
            setMessage(
                action === "delete"
                    ? `Deleted ${result.changed} products.`
                    : `Updated discount for ${result.changed} products.`,
            );
        } catch {
            setMessage(
                "Couldn't change the selected products. Refresh the list and try again.",
            );
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const imageInput = form.elements.namedItem("image");
        const image =
            imageInput instanceof HTMLInputElement
                ? imageInput.files?.[0]
                : undefined;
        if (
            image &&
            (image.size === 0 ||
                image.size > 5 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(image.type))
        ) {
            setMessage(
                "Choose a JPEG, PNG or WebP image no larger than 5 MiB.",
            );
            return;
        }
        const input = {
            name: String(values.get("name") ?? "").trim(),
            categoryId: String(values.get("categoryId") ?? ""),
            price: String(values.get("price") ?? ""),
            stockQuantity: Number(values.get("stockQuantity")),
            discountPercent: Number(values.get("discountPercent")),
            description: String(values.get("description") ?? "").trim() || null,
        };
        try {
            const product = await save({
                role: mode,
                id: editing?.id,
                input,
                sellerId:
                    mode === "admin"
                        ? String(values.get("sellerId") ?? "")
                        : undefined,
            }).unwrap();
            if (image) {
                try {
                    await upload({
                        role: mode,
                        productId: product.id,
                        file: image,
                    }).unwrap();
                } catch {
                    setEditing(product);
                    setFormKey((key) => key + 1);
                    setMessage(
                        "Product saved, but the image could not be uploaded. Check the image limit and storage, then select the image and save again.",
                    );
                    return;
                }
            }
            setEditing(null);
            setFormKey((key) => key + 1);
            setMessage(editing ? "Product updated." : "Product created.");
        } catch {
            setMessage(
                "Couldn't save the product. Check the fields and try again.",
            );
        }
    }

    async function deleteItem(product: ManagedProduct) {
        if (!window.confirm(`Delete ${product.name}? This cannot be undone.`))
            return;
        try {
            await remove({ role: mode, id: product.id }).unwrap();
            setSelected((current) => current.filter((id) => id !== product.id));
            if (editing?.id === product.id) setEditing(null);
            setMessage("Product deleted.");
        } catch {
            setMessage("Couldn't delete the product. Try again.");
        }
    }

    return (
        <section aria-labelledby="products-heading">
            <h2 id="products-heading">Products</h2>
            <label className="my-3 block font-medium">
                Search products{" "}
                <input
                    className="ml-2"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                        setSelected([]);
                    }}
                />
            </label>
            {isFetching && <output>Loading products…</output>}
            {isError && (
                <p role="alert">
                    Couldn't load products.{" "}
                    <button onClick={() => void refetch()}>Retry</button>
                </p>
            )}
            {products?.length === 0 && !isFetching && <p>No products found.</p>}
            {products && (
                <ul className="my-4 grid gap-2">
                    {products.map((product) => (
                        <li
                            className="rounded-tile bg-store-surface p-3"
                            key={product.id}
                        >
                            <input
                                className="mr-2"
                                type="checkbox"
                                aria-label={`Select ${product.name}`}
                                checked={selected.includes(product.id)}
                                onChange={(event) =>
                                    setSelected((current) =>
                                        event.target.checked
                                            ? [...current, product.id]
                                            : current.filter(
                                                  (id) => id !== product.id,
                                              ),
                                    )
                                }
                            />{" "}
                            {product.name} — {product.price}, stock{" "}
                            {product.stockQuantity}{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(product);
                                    setFormKey((key) => key + 1);
                                }}
                            >
                                Edit
                            </button>{" "}
                            <button
                                className="text-store-danger"
                                type="button"
                                disabled={removeState.isLoading}
                                onClick={() => void deleteItem(product)}
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {products && products.length > 0 && (
                <section
                    className="my-4 rounded-panel bg-store-surface p-4"
                    aria-label="Bulk product actions"
                >
                    <button
                        type="button"
                        onClick={() =>
                            setSelected(products.map((product) => product.id))
                        }
                    >
                        Select all on this page
                    </button>{" "}
                    <button
                        type="button"
                        onClick={() => setSelected([])}
                        disabled={selected.length === 0}
                    >
                        Clear selection
                    </button>
                    <p>{selected.length} selected on this page</p>
                    <label>
                        Discount (%) for selected{" "}
                        <input
                            className="ml-2 w-24"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={discount}
                            onChange={(event) =>
                                setDiscount(event.target.value)
                            }
                        />
                    </label>{" "}
                    <button
                        className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                        type="button"
                        disabled={selected.length === 0 || bulkState.isLoading}
                        onClick={() => void applyBulk("discount")}
                    >
                        Apply discount
                    </button>{" "}
                    <button
                        className="text-store-danger"
                        type="button"
                        disabled={selected.length === 0 || bulkState.isLoading}
                        onClick={() => void applyBulk("delete")}
                    >
                        Delete selected
                    </button>
                </section>
            )}
            <nav
                aria-label="Product pages"
                className="my-4 flex flex-wrap items-center gap-2"
            >
                <button
                    type="button"
                    disabled={page === 1 || isFetching}
                    onClick={() => {
                        setSelected([]);
                        setPage(page - 1);
                    }}
                >
                    Previous
                </button>{" "}
                Page {page}{" "}
                <button
                    type="button"
                    disabled={isFetching || !products || products.length < 20}
                    onClick={() => {
                        setSelected([]);
                        setPage(page + 1);
                    }}
                >
                    Next
                </button>
            </nav>
            <h3>{editing ? "Edit product" : "Add product"}</h3>
            <form
                className="my-4 space-y-3 rounded-panel bg-store-surface p-5"
                key={formKey}
                onSubmit={(event) => void submit(event)}
            >
                {editing && <p>Product ID: {editing.id}</p>}
                <p>
                    <label>
                        Name{" "}
                        <input
                            className="ml-2"
                            name="name"
                            required
                            maxLength={200}
                            defaultValue={editing?.name}
                        />
                    </label>
                </p>
                <CategoryPicker initialId={editing?.categoryId} />
                {mode === "admin" && !editing && <SellerPicker />}
                {editing && (
                    <p>Seller ID: {editing.sellerId} (cannot be changed)</p>
                )}
                <p>
                    <label>
                        Price{" "}
                        <input
                            className="ml-2"
                            name="price"
                            required
                            pattern="(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?"
                            defaultValue={editing?.price ?? "0.00"}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Stock{" "}
                        <input
                            className="ml-2"
                            name="stockQuantity"
                            type="number"
                            min="0"
                            max="2147483647"
                            required
                            defaultValue={editing?.stockQuantity ?? 0}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Discount (%){" "}
                        <input
                            className="ml-2"
                            name="discountPercent"
                            type="number"
                            min="0"
                            max="100"
                            required
                            defaultValue={editing?.discountPercent ?? 0}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Description{" "}
                        <textarea
                            className="ml-2"
                            name="description"
                            maxLength={5000}
                            defaultValue={editing?.description ?? ""}
                        />
                    </label>
                </p>
                <p>
                    <label>
                        Product image (JPEG, PNG or WebP, up to 5 MiB){" "}
                        <input
                            className="ml-2 max-w-full"
                            name="image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                        />
                    </label>
                </p>
                <button
                    type="submit"
                    disabled={saveState.isLoading || uploadState.isLoading}
                >
                    {saveState.isLoading || uploadState.isLoading
                        ? "Saving…"
                        : "Save product"}
                </button>
                {editing && (
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(null);
                            setFormKey((key) => key + 1);
                        }}
                    >
                        Cancel editing
                    </button>
                )}
            </form>
            {message && <output>{message}</output>}
            {editing && <ProductImages productId={editing.id} mode={mode} />}
        </section>
    );
}
