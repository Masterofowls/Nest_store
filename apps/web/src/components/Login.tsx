"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signInSchema } from "@/entities/user/model/sign-in.schema";
import { useSignInMutation } from "@/shared/api/baseApi";
import { getErrorStatus } from "@/shared/api/response";

export default function Login() {
    const router = useRouter();
    const [signIn, { isLoading }] = useSignInMutation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const input = signInSchema.safeParse({ email: email.trim(), password });
        if (!input.success || password.length === 0) {
            setError("Enter a valid email and your password.");
            return;
        }

        setError("");
        try {
            await signIn(input.data).unwrap();
            router.push("/profile");
        } catch (signInError: unknown) {
            setError(
                getErrorStatus(signInError) === 401
                    ? "Email or password is incorrect."
                    : "Couldn't sign in. Try again.",
            );
        }
    }

    return (
        <section aria-labelledby="login-heading" className="mx-auto max-w-lg">
            <h1 id="login-heading" className="mb-6">
                Sign in
            </h1>
            <form
                aria-label="Sign in"
                noValidate
                onSubmit={handleSubmit}
                className="rounded-2xl bg-store-surface p-6"
            >
                <label className="mb-2 block font-medium" htmlFor="login-email">
                    Email
                </label>
                <input
                    className="mb-4 w-full"
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                />
                <label
                    className="mb-2 block font-medium"
                    htmlFor="login-password"
                >
                    Password
                </label>
                <input
                    className="mb-4 w-full"
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                />
                {error && <p role="alert">{error}</p>}
                <button
                    className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? "Signing in…" : "Sign in"}
                </button>
            </form>
            <p className="mt-3">
                No account yet? <Link href="/signup">Create one</Link>
            </p>
        </section>
    );
}
