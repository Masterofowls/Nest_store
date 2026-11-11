"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signUpSchema } from "@/entities/user/model/sign-up.schema";
import { useSignUpMutation } from "@/shared/api/baseApi";
import { getErrorStatus } from "@/shared/api/response";

export default function Signup() {
    const router = useRouter();
    const [signUp, { isLoading }] = useSignUpMutation();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const input = signUpSchema.safeParse({
            name: name.trim(),
            email: email.trim(),
            password,
        });
        if (!input.success || input.data.name.length === 0) {
            setError(
                "Enter your name, a valid email, and a password of 8 to 128 characters.",
            );
            return;
        }

        setError("");
        try {
            await signUp(input.data).unwrap();
            router.push("/profile");
        } catch (signUpError: unknown) {
            setError(
                getErrorStatus(signUpError) === 422
                    ? "An account with this email already exists."
                    : "Couldn't create the account. Try again.",
            );
        }
    }

    return (
        <section aria-labelledby="signup-heading" className="mx-auto max-w-lg">
            <h1 id="signup-heading" className="mb-6">
                Create an account
            </h1>
            <form
                className="rounded-panel bg-store-surface p-6"
                aria-label="Create an account"
                noValidate
                onSubmit={handleSubmit}
            >
                <label className="mb-2 block font-medium" htmlFor="signup-name">
                    Name
                </label>
                <input
                    className="mb-4 w-full"
                    id="signup-name"
                    name="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                />
                <label
                    className="mb-2 block font-medium"
                    htmlFor="signup-email"
                >
                    Email
                </label>
                <input
                    className="mb-4 w-full"
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                />
                <label
                    className="mb-2 block font-medium"
                    htmlFor="signup-password"
                >
                    Password
                </label>
                <input
                    className="w-full"
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    aria-describedby="signup-password-hint"
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <p
                    className="my-2 text-sm text-store-muted"
                    id="signup-password-hint"
                >
                    8 to 128 characters.
                </p>
                {error && <p role="alert">{error}</p>}
                <button
                    className="border-0 bg-store-primary text-white hover:bg-store-primary-hover"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? "Creating account…" : "Create account"}
                </button>
            </form>
            <p className="mt-3">
                Already have an account? <Link href="/login">Sign in</Link>
            </p>
        </section>
    );
}
