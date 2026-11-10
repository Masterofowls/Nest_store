// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Filters, { type CatalogFilters } from "./Filters";

const server = setupApiServer();
const categories = [
    { id: "00000000-0000-4000-8000-000000000102", name: "Accessories" },
    { id: "00000000-0000-4000-8000-000000000103", name: "Audio" },
];

const emptyFilters: CatalogFilters = {
    categoryId: "",
    minPrice: "",
    maxPrice: "",
    discounted: false,
    inStock: false,
};

describe("Filters", () => {
    it("lists categories and reports the selected one", async () => {
        server.use(
            http.get(`${api}/categories`, () => HttpResponse.json(categories)),
        );
        const onChange = vi.fn<(changes: Partial<CatalogFilters>) => void>();
        renderWithStore(<Filters filters={emptyFilters} onChange={onChange} />);

        await screen.findByRole("option", { name: "Audio" });
        await userEvent
            .setup()
            .selectOptions(screen.getByLabelText("Category"), "Audio");

        expect(onChange).toHaveBeenCalledWith({
            categoryId: categories[1]?.id,
        });
    });

    it("allows retrying a failed category request", async () => {
        let shouldFail = true;
        server.use(
            http.get(`${api}/categories`, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json(categories);
            }),
        );
        renderWithStore(
            <Filters
                filters={emptyFilters}
                onChange={vi.fn<(changes: Partial<CatalogFilters>) => void>()}
            />,
        );

        expect(
            await screen.findByText("Couldn't load categories."),
        ).not.toBeNull();
        expect(screen.getByLabelText("Category")).toHaveProperty(
            "disabled",
            true,
        );

        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Retry" }));

        expect(
            await screen.findByRole("option", { name: "Accessories" }),
        ).not.toBeNull();
    });

    it("nests subcategories under their parent", async () => {
        server.use(
            http.get(`${api}/categories`, () =>
                HttpResponse.json([
                    ...categories,
                    {
                        id: "00000000-0000-4000-8000-000000000104",
                        name: "Headphones",
                        parentId: categories[1]?.id,
                    },
                ]),
            ),
        );
        renderWithStore(
            <Filters
                filters={emptyFilters}
                onChange={vi.fn<(changes: Partial<CatalogFilters>) => void>()}
            />,
        );

        await screen.findByRole("option", { name: "Audio" });
        const names = screen
            .getAllByRole("option")
            .map((option) => option.textContent?.trim());
        expect(names).toEqual([
            "All categories",
            "Accessories",
            "Audio",
            "Headphones",
        ]);
    });

    it("applies a valid price range and reports checkbox changes", async () => {
        server.use(
            http.get(`${api}/categories`, () => HttpResponse.json(categories)),
        );
        const onChange = vi.fn<(changes: Partial<CatalogFilters>) => void>();
        const user = userEvent.setup();
        renderWithStore(<Filters filters={emptyFilters} onChange={onChange} />);

        await user.type(screen.getByLabelText("From"), "20");
        await user.type(screen.getByLabelText("To"), "99.5");
        await user.click(screen.getByRole("button", { name: "Apply price" }));
        expect(onChange).toHaveBeenCalledWith({
            minPrice: "20",
            maxPrice: "99.5",
        });

        await user.click(screen.getByLabelText("Discounted only"));
        expect(onChange).toHaveBeenCalledWith({ discounted: true });
        await user.click(screen.getByLabelText("In stock only"));
        expect(onChange).toHaveBeenCalledWith({ inStock: true });
    });

    it.each([
        ["abc", "", "Enter prices as numbers, for example 25 or 19.99."],
        ["50", "10", "The lowest price must not be above the highest."],
    ])(
        "rejects the price range %s to %s",
        async (minPrice, maxPrice, message) => {
            server.use(
                http.get(`${api}/categories`, () =>
                    HttpResponse.json(categories),
                ),
            );
            const onChange =
                vi.fn<(changes: Partial<CatalogFilters>) => void>();
            const user = userEvent.setup();
            renderWithStore(
                <Filters filters={emptyFilters} onChange={onChange} />,
            );

            await user.type(screen.getByLabelText("From"), minPrice);
            if (maxPrice)
                await user.type(screen.getByLabelText("To"), maxPrice);
            await user.click(
                screen.getByRole("button", { name: "Apply price" }),
            );

            expect((await screen.findByRole("alert")).textContent).toBe(
                message,
            );
            expect(
                screen.getByLabelText("From").getAttribute("aria-invalid"),
            ).toBe("true");
            expect(onChange).not.toHaveBeenCalled();
        },
    );
});
