// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { makeStore } from "@/app/store";
import { api, makeProduct, setupApiServer } from "@/test/api-server";
import { compareLoaded } from "../model/compareSlice";
import Compare from "./Compare";

const server = setupApiServer();
const keyboard = {
    ...makeProduct(),
    slug: "mechanical-keyboard-00000001",
    brand: { id: "00000000-0000-4000-8000-000000000201", name: "Keychron" },
    attributes: [
        {
            slug: "weight",
            name: "Weight",
            type: "number",
            unit: "g",
            value: "780",
        },
        {
            slug: "anc",
            name: "Noise cancelling",
            type: "boolean",
            unit: null,
            value: "false",
        },
    ],
    variants: [],
};
const mouse = {
    ...makeProduct({
        id: "00000000-0000-4000-8000-000000000002",
        name: "Wireless Mouse",
    }),
    brand: null,
    attributes: [],
    variants: [],
};

function renderCompare(ids: string[]) {
    const store = makeStore();
    store.dispatch(compareLoaded(ids));
    render(
        <Provider store={store}>
            <Compare />
        </Provider>,
    );
    return store;
}

describe("Compare", () => {
    it("invites the user to add products when the list is empty", () => {
        renderCompare([]);
        expect(screen.getByText(/Nothing to compare yet/)).not.toBeNull();
        expect(
            screen
                .getByRole("link", { name: "Open the catalog" })
                .getAttribute("href"),
        ).toBe("/catalog");
    });

    it("shows attributes side by side and fills gaps with a dash", async () => {
        server.use(
            http.get(`${api}/products/compare`, () =>
                HttpResponse.json([keyboard, mouse]),
            ),
        );
        renderCompare([keyboard.id, mouse.id]);

        const weight = await screen.findByRole("row", { name: /Weight/ });
        expect(
            within(weight)
                .getAllByRole("cell")
                .map((cell) => cell.textContent),
        ).toEqual(["780 g", "—"]);
        const anc = screen.getByRole("row", { name: /Noise cancelling/ });
        expect(within(anc).getAllByRole("cell")[0]?.textContent).toBe("No");
        expect(
            screen
                .getByRole("link", { name: "Mechanical Keyboard" })
                .getAttribute("href"),
        ).toBe("/products/mechanical-keyboard-00000001");
    });

    it("removes a product from the comparison", async () => {
        server.use(
            http.get(`${api}/products/compare`, () =>
                HttpResponse.json([keyboard, mouse]),
            ),
        );
        const store = renderCompare([keyboard.id, mouse.id]);

        await userEvent.setup().click(
            await screen.findByRole("button", {
                name: "Remove Wireless Mouse from comparison",
            }),
        );
        expect(store.getState().compare.ids).toEqual([keyboard.id]);
    });

    it("allows retrying a failed comparison request", async () => {
        let shouldFail = true;
        server.use(
            http.get(`${api}/products/compare`, () => {
                if (shouldFail) {
                    shouldFail = false;
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json([keyboard]);
            }),
        );
        renderCompare([keyboard.id]);

        await userEvent
            .setup()
            .click(await screen.findByRole("button", { name: "Retry" }));
        expect(
            await screen.findByRole("link", { name: "Mechanical Keyboard" }),
        ).not.toBeNull();
    });
});
