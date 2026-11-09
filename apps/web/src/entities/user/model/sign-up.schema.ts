import { z } from "zod";

export const signUpSchema = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(8).max(128),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
