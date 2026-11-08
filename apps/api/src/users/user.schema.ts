import { z } from 'zod';

export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});
export const deleteUserSchema = z.strictObject({}).optional();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
