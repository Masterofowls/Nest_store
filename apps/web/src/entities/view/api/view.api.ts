import {
    getJson,
    parseResponse,
    searchQuerySchema,
    type SearchQuery,
} from "../../../shared/api/response";
import {
    viewHistoryItemSchema,
    viewHistorySchema,
    viewSchema,
} from "../model/view.schema";

export function parseView(value: unknown) {
    return parseResponse(viewSchema, value, "product view");
}

export function parseViewHistoryItem(value: unknown) {
    return parseResponse(viewHistoryItemSchema, value, "view history item");
}

export function parseViewHistory(value: unknown) {
    return parseResponse(viewHistorySchema, value, "view history");
}

export async function getViewHistory(api: string, query: SearchQuery = {}) {
    return parseViewHistory(
        await getJson(
            api,
            "users/me/views",
            "View history",
            searchQuerySchema.parse(query),
        ),
    );
}
