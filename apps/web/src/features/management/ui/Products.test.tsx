// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import Products from "./Products";

const server = setupApiServer();
const product = makeProduct();
const seller = {
    id: product.sellerId,
    storeName: "Keyboard store",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};

function commonHandlers() {
    server.use(
        http.get(`${api}/products`, () => HttpResponse.json([product])),
        http.get(`${api}/categories`, () =>
            HttpResponse.json([{ id: product.categoryId, name: "Keyboards" }]),
        ),
        http.get(`${api}/sellers`, () => HttpResponse.json([seller])),
        http.get(`${api}/products/${product.id}/images`, () =>
            HttpResponse.json([]),
        ),
    );
}

describe.each(["admin", "seller"] as const)("%s product form", (role) => {
    it("creates a product with every editable field and an image", async () => {
        commonHandlers();
        const created = vi.fn<(body: unknown) => void>();
        const imageUpload = vi.fn<(contentType: string | null) => void>();
        const prefix = role === "admin" ? "/admin" : "";
        server.use(
            http.post(`${api}${prefix}/products`, async ({ request }) => {
                created(await request.json());
                return HttpResponse.json(product, { status: 201 });
            }),
            http.post(
                `${api}${prefix}/products/${product.id}/images`,
                ({ request }) => {
                    imageUpload(request.headers.get("content-type"));
                    return HttpResponse.json({ id: "image" });
                },
            ),
        );
        renderWithStore(
            <Products
                mode={role}
                sellerId={role === "seller" ? seller.id : undefined}
            />,
        );
        const person = userEvent.setup();
        await person.type(screen.getByLabelText("Name"), "Mechanical Keyboard");
        await person.selectOptions(
            await screen.findByLabelText("Category"),
            product.categoryId,
        );
        if (role === "admin")
            await person.selectOptions(
                await screen.findByLabelText("Seller"),
                product.sellerId,
            );
        await person.clear(screen.getByLabelText("Price"));
        await person.type(screen.getByLabelText("Price"), "89.99");
        await person.clear(screen.getByLabelText("Stock"));
        await person.type(screen.getByLabelText("Stock"), "24");
        await person.clear(screen.getByLabelText("Discount (%)"));
        await person.type(screen.getByLabelText("Discount (%)"), "10");
        await person.type(
            screen.getByLabelText("Description"),
            "Compact mechanical keyboard",
        );
        const image = screen.getByLabelText<HTMLInputElement>(/Product image/);
        await person.upload(
            image,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        const form = image.closest("form");
        if (!form) throw new Error("Missing product form");
        fireEvent.submit(form);
        expect(await screen.findByText("Product created.")).toBeTruthy();
        expect(created).toHaveBeenCalledWith({
            name: product.name,
            categoryId: product.categoryId,
            price: product.price,
            stockQuantity: product.stockQuantity,
            discountPercent: product.discountPercent,
            description: product.description,
            ...(role === "admin" ? { sellerId: product.sellerId } : {}),
        });
        expect(imageUpload).toHaveBeenCalledWith(
            expect.stringContaining("multipart/form-data"),
        );
    });

    it("preserves the created product for retry when image upload fails", async () => {
        commonHandlers();
        const create = vi.fn<() => void>();
        const prefix = role === "admin" ? "/admin" : "";
        let attempts = 0;
        server.use(
            http.post(`${api}${prefix}/products`, () => {
                create();
                return HttpResponse.json(product, { status: 201 });
            }),
            http.patch(`${api}${prefix}/products/${product.id}`, () =>
                HttpResponse.json(product),
            ),
            http.post(`${api}${prefix}/products/${product.id}/images`, () => {
                attempts++;
                return attempts === 1
                    ? new HttpResponse(null, { status: 503 })
                    : HttpResponse.json({ id: "image" });
            }),
        );
        renderWithStore(
            <Products
                mode={role}
                sellerId={role === "seller" ? seller.id : undefined}
            />,
        );
        const person = userEvent.setup();
        const image = screen.getByLabelText<HTMLInputElement>(/Product image/);
        await person.upload(
            image,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        const form = image.closest("form");
        if (!form) throw new Error("Missing product form");
        fireEvent.submit(form);
        expect(
            await screen.findByText(
                /Product saved, but the image could not be uploaded/,
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole("heading", { name: "Edit product" }),
        ).toBeTruthy();
        expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
            product.name,
        );
        const retryImage =
            screen.getByLabelText<HTMLInputElement>(/Product image/);
        await person.upload(
            retryImage,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        const retryForm = retryImage.closest("form");
        if (!retryForm) throw new Error("Missing product form");
        fireEvent.submit(retryForm);
        expect(await screen.findByText("Product updated.")).toBeTruthy();
        expect(attempts).toBe(2);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it("shows product fields and existing images while editing", async () => {
        commonHandlers();
        renderWithStore(
            <Products
                mode={role}
                sellerId={role === "seller" ? seller.id : undefined}
            />,
        );
        const row = (await screen.findByText(/Mechanical Keyboard —/)).closest(
            "li",
        );
        if (!row) throw new Error("Missing product row");
        await userEvent.click(
            within(row).getByRole("button", { name: "Edit" }),
        );
        expect(screen.getByLabelText("Name")).toBeTruthy();
        expect(screen.getByLabelText("Category")).toBeTruthy();
        expect(screen.getByLabelText("Price")).toBeTruthy();
        expect(screen.getByLabelText("Stock")).toBeTruthy();
        expect(screen.getByLabelText("Discount (%)")).toBeTruthy();
        expect(screen.getByLabelText("Description")).toBeTruthy();
        expect(screen.getByLabelText(/Product image/)).toBeTruthy();
        expect(await screen.findByText("No product images.")).toBeTruthy();
    });

    it("uploads an image while saving changes to an existing product", async () => {
        commonHandlers();
        const prefix = role === "admin" ? "/admin" : "";
        const uploaded = vi.fn<() => void>();
        server.use(
            http.patch(`${api}${prefix}/products/${product.id}`, () =>
                HttpResponse.json(product),
            ),
            http.post(`${api}${prefix}/products/${product.id}/images`, () => {
                uploaded();
                return HttpResponse.json({ id: "image" });
            }),
        );
        renderWithStore(
            <Products
                mode={role}
                sellerId={role === "seller" ? seller.id : undefined}
            />,
        );
        const person = userEvent.setup();
        const row = (await screen.findByText(/Mechanical Keyboard —/)).closest(
            "li",
        );
        if (!row) throw new Error("Missing product row");
        await person.click(within(row).getByRole("button", { name: "Edit" }));
        const image = screen.getByLabelText<HTMLInputElement>(/Product image/);
        await person.upload(
            image,
            new File(["image"], "photo.png", { type: "image/png" }),
        );
        const form = image.closest("form");
        if (!form) throw new Error("Missing product form");
        fireEvent.submit(form);
        expect(await screen.findByText("Product updated.")).toBeTruthy();
        expect(uploaded).toHaveBeenCalledTimes(1);
    });
});
