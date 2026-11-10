// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, renderWithStore, setupApiServer } from "@/test/api-server";
import AdminBanners from "./AdminBanners";

const server = setupApiServer();

describe("AdminBanners", () => {
    it("creates a banner and refreshes the list", async () => {
        let banners: {
            id: string;
            title: string;
            description: string | null;
            linkUrl: string | null;
            imageUrl: string | null;
            isActive: boolean;
            sortOrder: number;
        }[] = [];
        const created = vi.fn<(body: unknown) => void>();
        server.use(
            http.get(`${api}/admin/banners`, () => HttpResponse.json(banners)),
            http.post(`${api}/admin/banners`, async ({ request }) => {
                created(await request.json());
                banners = [
                    {
                        id: "00000000-0000-4000-8000-000000000001",
                        title: "Summer sale",
                        description: null,
                        linkUrl: "/catalog",
                        imageUrl: null,
                        isActive: true,
                        sortOrder: 0,
                    },
                ];
                return HttpResponse.json(banners[0], { status: 201 });
            }),
        );
        renderWithStore(<AdminBanners />);
        const person = userEvent.setup();
        await person.type(screen.getByLabelText("Title"), "Summer sale");
        await person.type(
            screen.getByLabelText("Link (site path or HTTP URL)"),
            "/catalog",
        );
        await person.click(screen.getByRole("button", { name: "Save banner" }));
        expect(await screen.findByText("Banner saved.")).toBeTruthy();
        expect(created).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Summer sale",
                linkUrl: "/catalog",
                isActive: true,
            }),
        );
        expect(await screen.findByText(/Summer sale — Active/)).toBeTruthy();
    });

    it("reports a rejected banner without claiming success", async () => {
        server.use(
            http.get(`${api}/admin/banners`, () => HttpResponse.json([])),
            http.post(
                `${api}/admin/banners`,
                () => new HttpResponse(null, { status: 400 }),
            ),
        );
        renderWithStore(<AdminBanners />);
        const person = userEvent.setup();
        await person.type(screen.getByLabelText("Title"), "Sale");
        await person.click(screen.getByRole("button", { name: "Save banner" }));
        expect(
            await screen.findByText(/Couldn't save the banner/),
        ).toBeTruthy();
        expect(screen.queryByText("Banner saved.")).toBeNull();
    });
});
