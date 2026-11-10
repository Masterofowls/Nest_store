import { z } from 'zod';

export const paginationFields = {
  search: z.string().trim().max(200).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(2_147_483_647))
    .default(1),
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .default(10),
};

export const paginationSchema = z.strictObject(paginationFields);
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const pageOnlySchema = z.strictObject({
  page: paginationFields.page,
  limit: paginationFields.limit,
});
export type PageOnlyQuery = z.infer<typeof pageOnlySchema>;
