import { z } from "zod";

export const signInSchema = z.object({
    email: z.email(),
    password: z.string().max(128),
});

export type SignInInput = z.infer<typeof signInSchema>;
