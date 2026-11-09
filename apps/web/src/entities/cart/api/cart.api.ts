import {
    getJson,
    pageQuerySchema,
    parseResponse,
    type PageQuery,
} from "../../../shared/api/response";
import {
    cartItemSchema,
    cartMutationItemSchema,
    cartSchema,
} from "../model/cart.schema";

export function parseCartItem(value: unknown) {
    return parseResponse(cartItemSchema, value, "cart item");
}

export function parseCartMutationItem(value: unknown) {
    return parseResponse(cartMutationItemSchema, value, "cart mutation item");
}

export function parseCart(value: unknown) {
    return parseResponse(cartSchema, value, "cart");
}

export async function getCart(api: string, query: PageQuery = {}) {
    return parseCart(
        await getJson(api, "cart", "Cart", pageQuerySchema.parse(query)),
    );
}
