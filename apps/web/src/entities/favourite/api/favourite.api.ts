import {
    getJson,
    parseResponse,
    searchQuerySchema,
    type SearchQuery,
} from "../../../shared/api/response";
import {
    favouriteListSchema,
    favouriteSchema,
} from "../model/favourite.schema";

export function parseFavourite(value: unknown) {
    return parseResponse(favouriteSchema, value, "favourite");
}

export function parseFavouriteList(value: unknown) {
    return parseResponse(favouriteListSchema, value, "favourite list");
}

export async function getFavourites(api: string, query: SearchQuery = {}) {
    return parseFavouriteList(
        await getJson(
            api,
            "favourites",
            "Favourite list",
            searchQuerySchema.parse(query),
        ),
    );
}
