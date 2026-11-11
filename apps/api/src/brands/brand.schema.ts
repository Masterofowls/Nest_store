import { z } from 'zod';

export const brandSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});

export type BrandInput = z.infer<typeof brandSchema>;
