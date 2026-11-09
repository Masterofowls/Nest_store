import { ApiError, parseApiBase } from "@/shared/api/response";

export async function signOut(api: string): Promise<void>{
    const base = parseApiBase(api);
    const url = new URL("api/auth/sign-out", base)
    const data = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
});
    if (!data.ok) {
            throw new ApiError('Sign out', data.status);
        }
}