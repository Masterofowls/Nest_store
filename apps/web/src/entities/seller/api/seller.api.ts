import {
    getJson,
    parseId,
    parseResponse,
    searchQuerySchema,
    type SearchQuery,
} from "../../../shared/api/response";
import { sellerListSchema, sellerSchema } from "../model/seller.schema";

export function parseSeller(value: unknown) {
    return parseResponse(sellerSchema, value, "seller");
}

export function parseSellerList(value: unknown) {
    return parseResponse(sellerListSchema, value, "seller list");
}

export async function getSellers(api: string, query: SearchQuery = {}) {
    return parseSellerList(
        await getJson(
            api,
            "sellers",
            "Seller list",
            searchQuerySchema.parse(query),
        ),
    );
}

export async function getSeller(api: string, id: string) {
    return parseSeller(await getJson(api, `sellers/${parseId(id)}`, "Seller"));
}

export async function getOwnSeller(api: string) {
    return parseSeller(await getJson(api, "sellers/me", "Own seller"));
}
