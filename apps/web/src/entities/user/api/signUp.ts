import { ApiError, parseApiBase } from "@/shared/api/response";
import { signUpSchema } from "../model/sign-up.schema";

export async function signUp(
    api: string,
    name: string,
    email: string,
    password: string,
): Promise<void> {
    const result = signUpSchema.safeParse({ name, email, password });

    if (!result.success) {
        throw result.error;
    }

    const base = parseApiBase(api);
    const url = new URL("api/auth/sign-up/email", base);
    const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(result.data),
        credentials: "same-origin",
    });

    if (!response.ok) {
        throw new ApiError("Sign up", response.status);
    }
}