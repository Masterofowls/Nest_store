import { z } from 'zod';
import { paginationSchema } from '../common/pagination.schema';

export const viewQuerySchema = paginationSchema;
export const createViewSchema = z.strictObject({}).optional();
export type ViewQuery = z.infer<typeof viewQuerySchema>;
