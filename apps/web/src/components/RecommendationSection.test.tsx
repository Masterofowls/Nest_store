// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
    api,
    makeProduct,
    renderWithStore,
    setupApiServer,
} from "@/test/api-server";
import RecommendationSection from "./RecommendationSection";

const server = setupApiServer();
const productId = "00000000-0000-4000-8000-000000000001";
const recommendationsUrl = `${api}/products/${productId}/recommendations`;

describe("RecommendationSection", () => {
    it("shows products viewed together with this one", async () => {
        let limit: string | null = null;
        server.use(
            http.get(recommendationsUrl, ({ request }) => {
                limit = new URL(request.url).searchParams.get("limit");
                return HttpResponse.json([
                    {
                        ...makeProduct({
                            id: "00000000-0000-4000-8000-000000000005",
                            name: "Wrist Rest",
                        }),
                        coViewers: 3,
                    },
                ]);
            }),
        );
        renderWithStore(<RecommendationSection productId={productId} />);

        expect(
            (
                await screen.findByRole("link", { name: "Wrist Rest" })
            ).getAttribute("href"),
        ).toBe("/products/00000000-0000-4000-8000-000000000005");
        expect(limit).toBe("4");
    });

    it("shows an empty state", async () => {
        server.use(http.get(recommendationsUrl, () => HttpResponse.json([])));
        renderWithStore(<RecommendationSection productId={productId} />);

        expect(
            await screen.findByText("No recommendations yet."),
        ).not.toBeNull();
    });

    it("allows retrying a failed request", async () => {
        let shouldFail = true;
        server.use(
            http.get(recommendationsUrl, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json([]);
            }),
        );
        renderWithStore(<RecommendationSection productId={productId} />);

        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Retry" }));

        expect(
            await screen.findByText("No recommendations yet."),
        ).not.toBeNull();
    });
});
