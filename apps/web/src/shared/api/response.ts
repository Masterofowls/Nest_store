import { z } from "zod";

export function parseResponse<T>(
    schema: z.ZodType<T>,
    value: unknown,
    description: string,
): T {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new Error(`Invalid ${description} response`, {
            cause: result.error,
        });
    }
    return result.data;
}

export class ApiError extends Error {
    constructor(
        description: string,
        readonly status: number,
    ) {
        super(`${description} request failed (HTTP ${status})`);
        this.name = "ApiError";
    }
}

export async function getJson(
    api: string,
    path: string,
    description: string,
    query: Record<string, string | number | undefined> = {},
): Promise<unknown> {
    const base = new URL(api);
    if (
        (base.protocol !== "http:" && base.protocol !== "https:") ||
        base.username ||
        base.password ||
        base.href !== `${base.origin}${base.pathname}` ||
        !base.pathname.endsWith("/")
    ) {
        throw new Error(
            "API base must be an HTTP or HTTPS URL with a trailing slash and no credentials, query, or fragment",
        );
    }
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }
    const response = await fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
    });
    if (!response.ok) {
        throw new ApiError(description, response.status);
    }
    const body: unknown = await response.json();
    return body;
}

export const pageQuerySchema = z.strictObject({
    page: z.number().int().min(1).max(2_147_483_647).optional(),
    limit: z.number().int().min(1).max(100).optional(),
});
export const searchQuerySchema = pageQuerySchema.extend({
    search: z.string().trim().max(200).optional(),
});
export type PageQuery = z.input<typeof pageQuerySchema>;
export type SearchQuery = z.input<typeof searchQuerySchema>;

export function parseId(id: string): string {
    return z.uuid().parse(id);
}
