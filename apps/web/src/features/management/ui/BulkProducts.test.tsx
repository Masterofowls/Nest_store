// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
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
import AdminTransfer from "./AdminTransfer";

const server = setupApiServer();
const first = makeProduct();
const second = makeProduct({
    id: "00000000-0000-4000-8000-000000000004",
    name: "Mouse",
});

describe.each(["admin", "seller"] as const)("%s bulk products", (mode) => {
    it("applies a discount and deletes selected products", async () => {
        let products = [first, second];
        const discount = vi.fn<(body: unknown) => void>();
        const deleted = vi.fn<(body: unknown) => void>();
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        server.use(
            http.get(`${api}/products`, () => HttpResponse.json(products)),
            http.get(`${api}/categories`, () => HttpResponse.json([])),
            http.get(`${api}/sellers`, () => HttpResponse.json([])),
            http.post(
                `${api}/${mode}/products/bulk/discount`,
                async ({ request }) => {
                    discount(await request.json());
                    return HttpResponse.json({ changed: 2 });
                },
            ),
            http.post(
                `${api}/${mode}/products/bulk/delete`,
                async ({ request }) => {
                    deleted(await request.json());
                    products = [];
                    return HttpResponse.json({ changed: 2 });
                },
            ),
        );
        renderWithStore(
            <Products
                mode={mode}
                sellerId={mode === "seller" ? first.sellerId : undefined}
            />,
        );
        const person = userEvent.setup();
        await screen.findByRole("checkbox", { name: "Select Mouse" });
        await person.click(
            screen.getByRole("button", { name: "Select all on this page" }),
        );
        const amount = screen.getByLabelText("Discount (%) for selected");
        await person.clear(amount);
        await person.type(amount, "25");
        await person.click(
            screen.getByRole("button", { name: "Apply discount" }),
        );
        expect(
            await screen.findByText("Updated discount for 2 products."),
        ).toBeTruthy();
        expect(discount).toHaveBeenCalledWith({
            ids: [first.id, second.id],
            discountPercent: 25,
        });
        await person.click(
            screen.getByRole("button", { name: "Select all on this page" }),
        );
        await person.click(
            screen.getByRole("button", { name: "Delete selected" }),
        );
        expect(await screen.findByText("Deleted 2 products.")).toBeTruthy();
        expect(deleted).toHaveBeenCalledWith({ ids: [first.id, second.id] });
        expect(confirm).toHaveBeenCalled();
        confirm.mockRestore();
    });

    it("reports failed bulk operations without clearing selection", async () => {
        server.use(
            http.get(`${api}/products`, () => HttpResponse.json([first])),
            http.get(`${api}/categories`, () => HttpResponse.json([])),
            http.get(`${api}/sellers`, () => HttpResponse.json([])),
            http.post(
                `${api}/${mode}/products/bulk/discount`,
                () => new HttpResponse(null, { status: 404 }),
            ),
        );
        renderWithStore(
            <Products
                mode={mode}
                sellerId={mode === "seller" ? first.sellerId : undefined}
            />,
        );
        const person = userEvent.setup();
        await person.click(
            await screen.findByRole("checkbox", {
                name: "Select Mechanical Keyboard",
            }),
        );
        await person.click(
            screen.getByRole("button", { name: "Apply discount" }),
        );
        expect(
            await screen.findByText(/Couldn't change the selected products/),
        ).toBeTruthy();
        expect(screen.getByText("1 selected on this page")).toBeTruthy();
    });
});

it("imports a seller CSV and shows the scoped backup link", async () => {
    const imported = vi.fn<(body: unknown) => void>();
    server.use(
        http.post(`${api}/seller/import/products`, async ({ request }) => {
            imported(await request.json());
            return HttpResponse.json({ created: 1 });
        }),
    );
    renderWithStore(<AdminTransfer mode="seller" />);
    const person = userEvent.setup();
    const file = new File(["csv"], "products.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
        value: async () =>
            "name,categoryId,price,stockQuantity\nMouse,id,2.00,1",
    });
    const input = screen.getByLabelText<HTMLInputElement>("CSV file");
    await person.upload(input, file);
    const form = input.closest("form");
    if (!form) throw new Error("Missing CSV form");
    fireEvent.submit(form);
    expect(await screen.findByText(/Imported 1/)).toBeTruthy();
    expect(imported).toHaveBeenCalledWith({
        csv: "name,categoryId,price,stockQuantity\nMouse,id,2.00,1",
    });
    expect(
        screen
            .getByRole("link", { name: "Download JSON backup" })
            .getAttribute("href"),
    ).toBe("/backend/seller/export/backup");
    expect(screen.queryByLabelText("Import type")).toBeNull();
});
