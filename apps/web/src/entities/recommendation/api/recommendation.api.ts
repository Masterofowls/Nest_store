import {
    getJson,
    pageQuerySchema,
    parseId,
    parseResponse,
    type PageQuery,
} from "../../../shared/api/response";
import {
    recommendationListSchema,
    recommendationSchema,
} from "../model/recommendation.schema";

export function parseRecommendation(value: unknown) {
    return parseResponse(recommendationSchema, value, "recommendation");
}

export function parseRecommendationList(value: unknown) {
    return parseResponse(
        recommendationListSchema,
        value,
        "recommendation list",
    );
}

export async function getRecommendations(
    api: string,
    productId: string,
    query: PageQuery = {},
) {
    return parseRecommendationList(
        await getJson(
            api,
            `products/${parseId(productId)}/recommendations`,
            "Recommendations",
            pageQuerySchema.parse(query),
        ),
    );
}
