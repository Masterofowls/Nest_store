import { z } from 'zod';

export const categorySchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
});

export type CategoryInput = z.infer<typeof categorySchema>;
