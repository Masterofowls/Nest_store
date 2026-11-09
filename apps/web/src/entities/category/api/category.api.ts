import {
    getJson,
    parseId,
    parseResponse,
    searchQuerySchema,
    type SearchQuery,
} from "../../../shared/api/response";
import { categoryListSchema, categorySchema } from "../model/category.schema";

export function parseCategory(value: unknown) {
    return parseResponse(categorySchema, value, "category");
}

export function parseCategoryList(value: unknown) {
    return parseResponse(categoryListSchema, value, "category list");
}

export async function getCategories(api: string, query: SearchQuery = {}) {
    return parseCategoryList(
        await getJson(
            api,
            "categories",
            "Category list",
            searchQuerySchema.parse(query),
        ),
    );
}

export async function getCategory(api: string, id: string) {
    return parseCategory(
        await getJson(api, `categories/${parseId(id)}`, "Category"),
    );
}
