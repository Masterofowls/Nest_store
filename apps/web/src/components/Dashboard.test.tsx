// @vitest-environment jsdom

import {
    cleanup,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
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

describe("Dashboard", () => {
    it("pages through all products without a search filter", async () => {
        server.use(
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
            http.get(`${origin}/backend/products/:productId/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/:productId/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        const user = userEvent.setup();
        renderDashboard();

        expect(
            await screen.findByRole("heading", { name: "Keyboard 1" }),
        ).not.toBeNull();
        expect(screen.queryByRole("searchbox")).toBeNull();

        const nextPageButton = screen.getByRole("button", {
            name: "Next page",
        });
        await waitFor(() => {
            expect(nextPageButton).toHaveProperty("disabled", false);
        });
        await user.click(nextPageButton);
        expect(
            await screen.findByRole("heading", { name: "Keyboard 11" }),
        ).not.toBeNull();
        expect(screen.getByText("Page 2")).not.toBeNull();
        expect(requests.every((request) => request.search === null)).toBe(true);
    });

    it("disables Previous page on the first page", async () => {
        server.use(
            http.get(`${origin}/backend/products`, () =>
                HttpResponse.json(makeProducts("Mouse", 1, 10)),
            ),
            http.get(`${origin}/backend/products/:productId/images`, () =>
                HttpResponse.json([]),
            ),
            http.get(`${origin}/backend/products/:productId/ratings`, () =>
                HttpResponse.json([]),
            ),
        );

        renderDashboard();
        await screen.findByRole("heading", { name: "Mouse 1" });

        const pagination = within(
            screen.getByRole("navigation", { name: "Product pages" }),
        );
        expect(
            pagination.getByRole("button", { name: "Previous page" }),
        ).toHaveProperty("disabled", true);
        const nextPageButton = pagination.getByRole("button", {
            name: "Next page",
        });
        await waitFor(() => {
            expect(nextPageButton).toHaveProperty("disabled", false);
        });
    });
});
