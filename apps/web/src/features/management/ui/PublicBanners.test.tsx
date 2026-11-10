// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import PublicBanners from "./PublicBanners";

const server = setupApiServer();
const banner = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "New arrivals",
    description: "See the latest products.",
    imageUrl: null,
    linkUrl: "/catalog",
    sortOrder: 0,
    isActive: true,
};

describe("PublicBanners", () => {
    it("renders a banner returned by the API", async () => {
        server.use(
            http.get(`${api}/banners`, () => HttpResponse.json([banner])),
        );
        renderWithStore(<PublicBanners />);
        expect(
            await screen.findByRole("link", { name: "View New arrivals" }),
        ).toHaveProperty("pathname", "/catalog");
    });

    it("rejects unsafe banner links", async () => {
        server.use(
            http.get(`${api}/banners`, () =>
                HttpResponse.json([
                    { ...banner, linkUrl: "javascript:alert(1)" },
                ]),
            ),
        );
        renderWithStore(<PublicBanners />);
        expect((await screen.findByRole("alert")).textContent).toContain(
            "Couldn't load banners.",
        );
    });
});
