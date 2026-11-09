import { currentUserSchema, type CurrentUser } from "../model/user.schema";

export function parseCurrentUser(argument: unknown): CurrentUser {
    const result = currentUserSchema.safeParse(argument);

    if (!result.success) {
        throw new Error("Invalid current user response", {
            cause: result.error,
        });
    }

    return result.data;
}
