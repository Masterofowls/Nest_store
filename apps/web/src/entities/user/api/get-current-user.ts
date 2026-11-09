import { getJson } from "../../../shared/api/response";
import type { CurrentUser } from "../model/user.schema";
import { parseCurrentUser } from "./parse-current-user";

export async function getCurrentUser(api: string): Promise<CurrentUser> {
    const data = await getJson(api, "users/me", "Current user");
    return parseCurrentUser(data);
}
