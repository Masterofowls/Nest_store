// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { makeStore } from "@/app/store";
import { api, setupApiServer } from "@/test/api-server";
import RecordProductView from "./RecordProductView";

const server = setupApiServer();
const productId = "00000000-0000-4000-8000-000000000001";
const user = {
    id: "user-1",
    name: "Buyer",
    email: "buyer@example.test",
    emailVerified: true,
    image: null,
};

describe("RecordProductView", () => {
    it("records a view once after the session is known", async () => {
        let requests = 0;
        server.use(
            http.get(`${api}/users/me`, () => HttpResponse.json(user)),
            http.post(`${api}/products/${productId}/views`, () => {
                requests += 1;
                return HttpResponse.json({
                    id: "00000000-0000-4000-8000-000000000002",
                    productId,
                    viewedAt: "2026-01-02T03:04:05.000Z",
                });
            }),
        );
        render(
            <Provider store={makeStore()}>
                <RecordProductView productId={productId} />
            </Provider>,
        );
        await waitFor(() => expect(requests).toBe(1));
    });
});
