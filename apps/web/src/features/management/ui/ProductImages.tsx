"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useGetProductImagesQuery } from "@/shared/api/baseApi";
import {
    useDeleteProductImageMutation,
    useUploadProductImageMutation,
} from "../api/management-api";

export default function ProductImages({
    productId,
    mode,
}: {
    productId: string;
    mode: "admin" | "seller";
}) {
    const images = useGetProductImagesQuery(productId);
    const [upload, uploading] = useUploadProductImageMutation();
    const [remove, removing] = useDeleteProductImageMutation();
    const [message, setMessage] = useState("");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("file");
        const file =
            input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (!file || file.size === 0 || file.size > 5 * 1024 * 1024) {
            setMessage("Choose an image no larger than 5 MiB.");
            return;
        }
        try {
            await upload({ role: mode, productId, file }).unwrap();
            form.reset();
            setMessage("Image uploaded.");
            void images.refetch();
        } catch {
            setMessage(
                "Couldn't upload the image. Check the file and storage availability, then try again.",
            );
        }
    }

    async function deleteImage(imageId: string) {
        if (!window.confirm("Delete this product image?")) return;
        try {
            await remove({ role: mode, productId, imageId }).unwrap();
            setMessage("Image deleted.");
            void images.refetch();
        } catch {
            setMessage(
                "Couldn't delete the image. Refresh the list and try again.",
            );
            void images.refetch();
        }
    }

    return (
        <section>
            <h4>Product images</h4>
            {images.isFetching && <output>Loading images…</output>}
            {images.isError && (
                <p role="alert">
                    Couldn't load images.{" "}
                    <button onClick={() => void images.refetch()}>Retry</button>
                </p>
            )}
            {images.data?.length === 0 && <p>No product images.</p>}
            <ul>
                {images.data?.map((image) => (
                    <li key={image.id}>
                        <Image
                            src={image.url}
                            alt="Product image"
                            width={120}
                            height={120}
                            unoptimized
                        />{" "}
                        <button
                            type="button"
                            disabled={removing.isLoading}
                            onClick={() => void deleteImage(image.id)}
                        >
                            Delete image
                        </button>
                    </li>
                ))}
            </ul>
            <form onSubmit={(event) => void submit(event)}>
                <label>
                    JPEG, PNG or WebP (up to 5 MiB){" "}
                    <input
                        name="file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        required
                    />
                </label>{" "}
                <button
                    disabled={
                        uploading.isLoading || (images.data?.length ?? 0) >= 8
                    }
                >
                    {uploading.isLoading ? "Uploading…" : "Upload image"}
                </button>
            </form>
            {message && <output>{message}</output>}
        </section>
    );
}
