import {
    getJson,
    parseId,
    parseResponse,
    searchQuerySchema,
    type SearchQuery,
} from "../../../shared/api/response";
import { ratingListSchema, ratingSchema } from "../model/rating.schema";

export function parseRating(value: unknown) {
    return parseResponse(ratingSchema, value, "rating");
}

export function parseRatingList(value: unknown) {
    return parseResponse(ratingListSchema, value, "rating list");
}

export async function getOwnRatings(api: string, query: SearchQuery = {}) {
    return parseRatingList(
        await getJson(
            api,
            "ratings",
            "Rating list",
            searchQuerySchema.parse(query),
        ),
    );
}

export async function getProductRatings(
    api: string,
    productId: string,
    query: SearchQuery = {},
) {
    return parseRatingList(
        await getJson(
            api,
            `products/${parseId(productId)}/ratings`,
            "Product ratings",
            searchQuerySchema.parse(query),
        ),
    );
}
