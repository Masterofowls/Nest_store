import { ApiError } from "../../../shared/api/response";
import type { CurrentUser } from "../model/user.schema";
import { getCurrentUser } from "./get-current-user";

export async function getOptionalCurrentUser(
    api: string,
): Promise<CurrentUser | null> {
    try {
        return await getCurrentUser(api);
    } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
            return null;
        }
        throw error;
    }
}
