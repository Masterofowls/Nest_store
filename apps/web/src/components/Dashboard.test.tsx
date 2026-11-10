// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { makeStore } from "@/app/store";
import Dashboard from "./Dashboard";

const origin = "http://localhost";
const sellerId = "00000000-0000-4000-8000-000000000101";
const categoryId = "00000000-0000-4000-8000-000000000102";
const requests: Array<{ page: string | null; search: string | null }> = [];
const server = setupServer();

class RelativeRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === "string" ? new URL(input, origin) : input, init);
    }
}

function makeProducts(name: string, start: number, count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(start + index).padStart(12, "0")}`,
        name: `${name} ${start + index}`,
        description: null,
        sellerId,
        categoryId,
        stockQuantity: 5,
        discountPercent: 0,
        price: "12.00",
    }));
}

function renderDashboard() {
    return render(
        <Provider store={makeStore()}>
            <Dashboard />
        </Provider>,
    );
}

beforeAll(() => {
    server.listen({ onUnhandledFrame: "error" });
    vi.stubGlobal("Request", RelativeRequest);
});

afterEach(() => {
    cleanup();
    server.resetHandlers();
    requests.length = 0;
});

afterAll(() => {
    vi.unstubAllGlobals();
    server.close();
});

function emptyProductDetails() {
    return [
        http.get(`${origin}/backend/products/:productId/images`, () =>
            HttpResponse.json([]),
        ),
        http.get(`${origin}/backend/products/:productId/ratings`, () =>
            HttpResponse.json([]),
        ),
    ];
}

describe("Dashboard", () => {
    it("shows a product feed without search and loads more on request", async () => {
        server.use(
            http.get(`${origin}/backend/users/me`, () =>
                HttpResponse.json(null, { status: 401 }),
            ),
            http.get(`${origin}/backend/products`, ({ request }) => {
                const url = new URL(request.url);
                const page = url.searchParams.get("page");
                requests.push({ page, search: url.searchParams.get("search") });
                return HttpResponse.json(
                    page === "2"
                        ? makeProducts("Keyboard", 11, 1)
                        : makeProducts("Keyboard", 1, 10),
                );
            }),
            ...emptyProductDetails(),
        );

        renderDashboard();

        expect(
            await screen.findByRole("heading", {
                name: "All products",
            }),
        ).not.toBeNull();
        await screen.findByRole("heading", { name: "Keyboard 1" });
        expect(screen.queryByRole("searchbox")).toBeNull();
        expect(
            screen.queryByRole("heading", { name: "You viewed" }),
        ).toBeNull();

        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Show more" }));
        expect(
            await screen.findByRole("heading", { name: "Keyboard 11" }),
        ).not.toBeNull();
        expect(requests.map((request) => request.page)).toEqual(["1", "2"]);
        expect(requests.every((request) => request.search === null)).toBe(true);
    });

    it("shows viewed products and similar products for a signed-in user", async () => {
        const [viewed] = makeProducts("Viewed keyboard", 50, 1);
        const [similar] = makeProducts("Similar mouse", 60, 1);
        server.use(
            http.get(`${origin}/backend/users/me`, () =>
                HttpResponse.json({
                    id: "user-1",
                    name: "Buyer",
                    email: "buyer@example.test",
                    emailVerified: false,
                    image: null,
                }),
            ),
            http.get(`${origin}/backend/users/me/views`, () =>
                HttpResponse.json([
                    {
                        id: "00000000-0000-4000-8000-000000000901",
                        productId: viewed?.id,
                        productName: viewed?.name,
                        viewedAt: "2026-11-10T00:00:00.000Z",
                    },
                ]),
            ),
            http.get(
                `${origin}/backend/products/:productId/recommendations`,
                () => HttpResponse.json([{ ...similar, coViewers: 2 }]),
            ),
            http.get(`${origin}/backend/products/:productId`, () =>
                HttpResponse.json(viewed),
            ),
            http.get(`${origin}/backend/products`, () =>
                HttpResponse.json(makeProducts("Keyboard", 1, 2)),
            ),
            ...emptyProductDetails(),
        );

        renderDashboard();

        expect(
            await screen.findByRole("heading", { name: "You viewed" }),
        ).not.toBeNull();
        expect(
            await screen.findByRole("heading", { name: "Viewed keyboard 50" }),
        ).not.toBeNull();
        expect(
            await screen.findByRole("heading", {
                name: "Similar to Viewed keyboard 50",
            }),
        ).not.toBeNull();
        expect(
            await screen.findByRole("heading", { name: "Similar mouse 60" }),
        ).not.toBeNull();
    });
});
