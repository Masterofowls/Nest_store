import { z } from "zod";

export const currentUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
