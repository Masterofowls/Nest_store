import type { CurrentUser } from "../model/user.schema";
import { signIn } from "./signIn";
import { getCurrentUser } from "./get-current-user";

export async function signInAndGetCurrentUser(api: string, email: string, password: string): Promise<CurrentUser>{
    await signIn(api, email, password)
    return getCurrentUser(api)
}