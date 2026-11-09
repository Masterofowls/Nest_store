import type { CurrentUser } from "../model/user.schema";
import { getCurrentUser } from "./get-current-user";
import { signUp } from "./signUp";

export async function signUpAndGetCurrentUser(
    api: string,
    name: string,
    email: string,
    password: string,
): Promise<CurrentUser> {
    await signUp(api, name, email, password);
    return getCurrentUser(api);
}
