// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import Filters from "./Filters";

const server = setupApiServer();
const categories = [
    { id: "00000000-0000-4000-8000-000000000102", name: "Accessories" },
    { id: "00000000-0000-4000-8000-000000000103", name: "Audio" },
];

describe("Filters", () => {
    it("lists categories and reports the selected one", async () => {
        server.use(
            http.get(`${api}/categories`, () => HttpResponse.json(categories)),
        );
        const onCategoryChange = vi.fn<(categoryId: string) => void>();
        renderWithStore(
            <Filters categoryId="" onCategoryChange={onCategoryChange} />,
        );

        await screen.findByRole("option", { name: "Audio" });
        await userEvent
            .setup()
            .selectOptions(screen.getByLabelText("Category"), "Audio");

        expect(onCategoryChange).toHaveBeenCalledWith(categories[1]?.id);
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
                categoryId=""
                onCategoryChange={vi.fn<(categoryId: string) => void>()}
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
});
