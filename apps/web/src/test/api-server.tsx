import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { makeStore } from "@/app/store";
import type { Product } from "@/entities/product/model/product.schema";

export const origin = "http://localhost";
export const api = `${origin}/backend`;

class RelativeRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === "string" ? new URL(input, origin) : input, init);
    }
}

export function setupApiServer() {
    const server = setupServer();

    beforeAll(() => {
        server.listen({ onUnhandledFrame: "error" });
        vi.stubGlobal("Request", RelativeRequest);
    });

    afterEach(() => {
        cleanup();
        server.resetHandlers();
    });

    afterAll(() => {
        vi.unstubAllGlobals();
        server.close();
    });

    return server;
}

export function renderWithStore(ui: ReactNode) {
    return render(<Provider store={makeStore()}>{ui}</Provider>);
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Mechanical Keyboard",
        description: "Compact mechanical keyboard",
        sellerId: "00000000-0000-4000-8000-000000000002",
        categoryId: "00000000-0000-4000-8000-000000000003",
        stockQuantity: 24,
        discountPercent: 10,
        price: "89.99",
        ...overrides,
    };
}
