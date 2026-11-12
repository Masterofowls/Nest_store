"use client";

import { useState, type FormEvent } from "react";
import {
    type AttributeDefinition,
    useCreateAttributeMutation,
    useDeleteAttributeMutation,
    useDeleteBrandMutation,
    useManagementAttributesQuery,
    useManagementBrandsQuery,
    useManagementCategoriesQuery,
    useSaveBrandMutation,
} from "../api/management-api";

const attributeTypes: { value: AttributeDefinition["type"]; label: string }[] =
    [
        { value: "text", label: "Text" },
        { value: "number", label: "Number" },
        { value: "boolean", label: "Yes or no" },
    ];

function Brands() {
    const brands = useManagementBrandsQuery();
    const [save, saveState] = useSaveBrandMutation();
    const [remove, removeState] = useDeleteBrandMutation();
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
            setMessage("Brand saved.");
        } catch {
            setMessage(
                "Couldn't save the brand. The name may already be taken.",
            );
        }
    }

    async function deleteItem(id: string, name: string) {
        if (
            !window.confirm(
                `Delete brand ${name}? Its products keep their other details and show no brand.`,
            )
        )
            return;
        try {
            await remove(id).unwrap();
            setMessage("Brand deleted.");
        } catch {
            setMessage("Couldn't delete the brand. Try again.");
        }
    }

    return (
        <section>
            <h2>Brands</h2>
            {brands.isLoading && <output>Loading brands…</output>}
            {brands.isError && (
                <p role="alert">
                    Couldn't load brands.{" "}
                    <button type="button" onClick={() => void brands.refetch()}>
                        Retry
                    </button>
                </p>
            )}
            {brands.currentData?.length === 0 && <p>No brands yet.</p>}
            <ul>
                {brands.currentData?.map((brand) => (
                    <li key={brand.id}>
                        {brand.name}{" "}
                        <button type="button" onClick={() => setEditing(brand)}>
                            Rename
                        </button>{" "}
                        <button
                            type="button"
                            disabled={removeState.isLoading}
                            onClick={() =>
                                void deleteItem(brand.id, brand.name)
                            }
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            <form
                key={editing?.id ?? "new"}
                onSubmit={(event) => void submit(event)}
            >
                <label>
                    {editing ? `Rename ${editing.name}` : "New brand"}{" "}
                    <input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={editing?.name}
                    />
                </label>{" "}
                <button type="submit" disabled={saveState.isLoading}>
                    Save brand
                </button>
                {editing && (
                    <button type="button" onClick={() => setEditing(null)}>
                        Cancel
                    </button>
                )}
            </form>
            {message && <output>{message}</output>}
        </section>
    );
}

function Attributes() {
    const attributes = useManagementAttributesQuery(undefined);
    const categories = useManagementCategoriesQuery(1);
    const [create, createState] = useCreateAttributeMutation();
    const [remove, removeState] = useDeleteAttributeMutation();
    const [message, setMessage] = useState("");
    const categoryName = new Map(
        categories.currentData?.map((category) => [category.id, category.name]),
    );

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const type = attributeTypes.find(
            (option) => option.value === values.get("type"),
        )?.value;
        if (!type) {
            setMessage("Choose a value type.");
            return;
        }
        try {
            await create({
                name: String(values.get("name") ?? "").trim(),
                slug: String(values.get("slug") ?? "").trim(),
                type,
                unit: String(values.get("unit") ?? "").trim() || null,
                categoryId: String(values.get("categoryId") ?? "") || null,
            }).unwrap();
            form.reset();
            setMessage("Specification added.");
        } catch {
            setMessage(
                "Couldn't add the specification. The address name may already be taken.",
            );
        }
    }

    async function deleteItem(attribute: AttributeDefinition) {
        if (
            !window.confirm(
                `Delete ${attribute.name}? Its values are removed from every product.`,
            )
        )
            return;
        try {
            await remove(attribute.id).unwrap();
            setMessage("Specification deleted.");
        } catch {
            setMessage("Couldn't delete the specification. Try again.");
        }
    }

    return (
        <section>
            <h2>Specifications</h2>
            <p className="text-store-muted">
                Specifications appear in product forms, on product pages, in
                catalog filters and in comparisons.
            </p>
            {attributes.isLoading && <output>Loading specifications…</output>}
            {attributes.isError && (
                <p role="alert">
                    Couldn't load specifications.{" "}
                    <button
                        type="button"
                        onClick={() => void attributes.refetch()}
                    >
                        Retry
                    </button>
                </p>
            )}
            {attributes.currentData?.length === 0 && (
                <p>No specifications yet.</p>
            )}
            <ul>
                {attributes.currentData?.map((attribute) => (
                    <li key={attribute.id}>
                        {attribute.name} ({attribute.slug},{" "}
                        {attributeTypes.find(
                            (option) => option.value === attribute.type,
                        )?.label ?? attribute.type}
                        {attribute.unit ? `, ${attribute.unit}` : ""},{" "}
                        {attribute.categoryId
                            ? (categoryName.get(attribute.categoryId) ??
                              "one category")
                            : "all categories"}
                        ){" "}
                        <button
                            type="button"
                            disabled={removeState.isLoading}
                            onClick={() => void deleteItem(attribute)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            <form
                className="space-y-2"
                onSubmit={(event) => void submit(event)}
            >
                <p>
                    <label>
                        Name <input name="name" required maxLength={120} />
                    </label>
                </p>
                <p>
                    <label>
                        Address name{" "}
                        <input
                            name="slug"
                            required
                            maxLength={60}
                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            aria-describedby="attribute-slug-help"
                        />
                    </label>
                    <span
                        className="block text-sm text-store-muted"
                        id="attribute-slug-help"
                    >
                        Lowercase letters, digits and hyphens, for example
                        screen-size. Used in filter links and cannot be changed
                        later.
                    </span>
                </p>
                <p>
                    <label>
                        Value type{" "}
                        <select name="type" required defaultValue="text">
                            {attributeTypes.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </p>
                <p>
                    <label>
                        Unit (optional) <input name="unit" maxLength={20} />
                    </label>
                </p>
                <p>
                    <label>
                        Category{" "}
                        <select name="categoryId" defaultValue="">
                            <option value="">All categories</option>
                            {categories.currentData?.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </p>
                <button type="submit" disabled={createState.isLoading}>
                    Add specification
                </button>
            </form>
            {message && <output>{message}</output>}
        </section>
    );
}

export default function AdminCatalogModel() {
    return (
        <>
            <Brands />
            <Attributes />
        </>
    );
}
