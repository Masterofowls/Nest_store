// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import Catalog from "./Catalog";

const server = setupApiServer();
const categoryId = "00000000-0000-4000-8000-000000000103";

function productPage(page: number, count: number) {
    return Array.from({ length: count }, (_, index) =>
        makeProduct({
            id: `00000000-0000-4000-8000-${String(page * 100 + index).padStart(12, "0")}`,
            name: `Product ${page}-${index + 1}`,
        }),
    );
}

describe("Catalog", () => {
    it("filters products by category and search from the first page", async () => {
        const requests: URLSearchParams[] = [];
        server.use(
            http.get(`${api}/categories`, () =>
                HttpResponse.json([{ id: categoryId, name: "Audio" }]),
            ),
            http.get(`${api}/products`, ({ request }) => {
                const params = new URL(request.url).searchParams;
                requests.push(params);
                if (params.get("categoryId") === categoryId) {
                    return HttpResponse.json([
                        makeProduct({ name: "Studio Headphones" }),
                    ]);
                }
                return HttpResponse.json(
                    params.get("page") === "1" ? productPage(1, 12) : [],
                );
            }),
        );
        const user = userEvent.setup();
        renderWithStore(<Catalog />);

        expect(await screen.findByText("Product 1-1")).not.toBeNull();
        expect(requests[0]?.get("limit")).toBe("12");

        await screen.findByRole("option", { name: "Audio" });
        await user.selectOptions(screen.getByLabelText("Category"), "Audio");
        expect(await screen.findByText("Studio Headphones")).not.toBeNull();
        expect(screen.queryByText("Product 1-1")).toBeNull();

        await user.type(
            screen.getByRole("searchbox", { name: "Search products" }),
            "studio",
        );
        await user.click(screen.getByRole("button", { name: "Search" }));

        await screen.findByText("Studio Headphones");
        const lastRequest = requests.at(-1);
        expect(lastRequest?.get("search")).toBe("studio");
        expect(lastRequest?.get("categoryId")).toBe(categoryId);
        expect(lastRequest?.get("page")).toBe("1");
    });

    it("pages through results and shows an empty state", async () => {
        server.use(
            http.get(`${api}/categories`, () => HttpResponse.json([])),
            http.get(`${api}/products`, ({ request }) => {
                const params = new URL(request.url).searchParams;
                if (params.get("search") === "missing") {
                    return HttpResponse.json([]);
                }
                const page = Number(params.get("page"));
                return HttpResponse.json(
                    page === 1
                        ? productPage(1, 12)
                        : page === 2
                          ? productPage(2, 3)
                          : [],
                );
            }),
        );
        const user = userEvent.setup();
        renderWithStore(<Catalog />);

        await screen.findByText("Product 1-1");
        const next = screen.getByRole("button", { name: "Next page" });
        await waitFor(() => expect(next).toHaveProperty("disabled", false));
        await user.click(next);

        expect(await screen.findByText("Product 2-1")).not.toBeNull();
        expect(screen.getByText("Page 2")).not.toBeNull();

        await user.type(
            screen.getByRole("searchbox", { name: "Search products" }),
            "missing",
        );
        await user.click(screen.getByRole("button", { name: "Search" }));

        expect(
            await screen.findByText("No products match these filters."),
        ).not.toBeNull();
    });

    it("sends sort, price, discount, stock and preselected category filters", async () => {
        const requests: URLSearchParams[] = [];
        server.use(
            http.get(`${api}/categories`, () =>
                HttpResponse.json([{ id: categoryId, name: "Audio" }]),
            ),
            http.get(`${api}/products`, ({ request }) => {
                requests.push(new URL(request.url).searchParams);
                return HttpResponse.json([]);
            }),
        );
        const user = userEvent.setup();
        renderWithStore(<Catalog initialCategoryId={categoryId} />);

        await screen.findByRole("option", { name: "Audio" });
        expect(
            (screen.getByLabelText("Category") as HTMLSelectElement).value,
        ).toBe(categoryId);
        await user.selectOptions(
            screen.getByLabelText("Sort by"),
            "Price: low to high",
        );
        await user.type(screen.getByLabelText("From"), "10");
        await user.type(screen.getByLabelText("To"), "50");
        await user.click(screen.getByRole("button", { name: "Apply price" }));
        await user.click(screen.getByLabelText("Discounted only"));
        await user.click(screen.getByLabelText("In stock only"));

        await waitFor(() => {
            const last = requests.at(-1);
            expect(last?.get("categoryId")).toBe(categoryId);
            expect(last?.get("sort")).toBe("price_asc");
            expect(last?.get("minPrice")).toBe("10");
            expect(last?.get("maxPrice")).toBe("50");
            expect(last?.get("discounted")).toBe("true");
            expect(last?.get("inStock")).toBe("true");
            expect(last?.get("page")).toBe("1");
        });
    });
});
