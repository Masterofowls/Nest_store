import { ApiError, parseApiBase } from "@/shared/api/response";
import { signInSchema } from "../model/sign-in.schema";

export async function signIn(api: string, email: string, password: string): Promise<void>{
    const result = signInSchema.safeParse({ email, password });
    
        if (!result.success) {
            throw result.error;
        }
    
    const base = parseApiBase(api);
    const url = new URL("api/auth/sign-in/email", base)
    const data = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(result.data),
    credentials: "same-origin",
});
        if (!data.ok) {
            throw new ApiError('Sign in', data.status);
        }
    
        return 
}