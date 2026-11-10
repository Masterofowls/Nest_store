// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import ProductImages from "./ProductImages";

const server = setupApiServer();
const productId = "00000000-0000-4000-8000-000000000001";

describe("ProductImages", () => {
    it("uploads a selected image using the product endpoint", async () => {
        const uploaded = vi.fn<(contentType: string | null) => void>();
        server.use(
            http.get(`${api}/products/${productId}/images`, () =>
                HttpResponse.json([]),
            ),
            http.post(`${api}/products/${productId}/images`, ({ request }) => {
                uploaded(request.headers.get("content-type"));
                return HttpResponse.json({ id: "image" });
            }),
        );
        renderWithStore(<ProductImages productId={productId} mode="seller" />);
        const person = userEvent.setup();
        const input =
            screen.getByLabelText<HTMLInputElement>(/JPEG, PNG or WebP/);
        await person.upload(
            input,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        expect(input.files?.length).toBe(1);
        const form = input.closest("form");
        if (!form) throw new Error("Missing upload form");
        fireEvent.submit(form);
        expect(await screen.findByText("Image uploaded.")).toBeTruthy();
        expect(uploaded).toHaveBeenCalledWith(
            expect.stringContaining("multipart/form-data"),
        );
    });

    it("reports an upload rejected by the server", async () => {
        server.use(
            http.get(`${api}/products/${productId}/images`, () =>
                HttpResponse.json([]),
            ),
            http.post(
                `${api}/products/${productId}/images`,
                () => new HttpResponse(null, { status: 503 }),
            ),
        );
        renderWithStore(<ProductImages productId={productId} mode="seller" />);
        const person = userEvent.setup();
        const input =
            screen.getByLabelText<HTMLInputElement>(/JPEG, PNG or WebP/);
        await person.upload(
            input,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        expect(input.files?.length).toBe(1);
        const form = input.closest("form");
        if (!form) throw new Error("Missing upload form");
        fireEvent.submit(form);
        expect(
            await screen.findByText(/Couldn't upload the image/),
        ).toBeTruthy();
    });

    it("deletes an image through the admin endpoint", async () => {
        const imageId = "00000000-0000-4000-8000-000000000004";
        const removed = vi.fn<() => void>();
        let hasImage = true;
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        server.use(
            http.get(`${api}/products/${productId}/images`, () =>
                HttpResponse.json(
                    hasImage
                        ? [
                              {
                                  id: imageId,
                                  productId,
                                  url: "https://example.test/image.webp",
                                  createdAt: "2026-01-01T00:00:00.000Z",
                              },
                          ]
                        : [],
                ),
            ),
            http.delete(
                `${api}/admin/products/${productId}/images/${imageId}`,
                () => {
                    removed();
                    hasImage = false;
                    return new HttpResponse(null, { status: 204 });
                },
            ),
        );
        renderWithStore(<ProductImages productId={productId} mode="admin" />);
        await userEvent.click(
            await screen.findByRole("button", { name: "Delete image" }),
        );
        expect(await screen.findByText("Image deleted.")).toBeTruthy();
        expect(removed).toHaveBeenCalledTimes(1);
        confirm.mockRestore();
    });
});
