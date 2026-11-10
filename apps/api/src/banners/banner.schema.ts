import { z } from 'zod';

function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    !url.username &&
    !url.password
  );
}

// Relative links must stay on this site: "//host" would leave it.
function isSiteLink(value: string): boolean {
  return (
    (value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\')) ||
    isHttpUrl(value)
  );
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

export const createBannerSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: optionalText(500),
  linkUrl: optionalText(2_000).refine(
    (value) => value == null || isSiteLink(value),
    'Link must be a site path starting with / or an http(s) URL',
  ),
  imageUrl: optionalText(2_000).refine(
    (value) => value == null || isHttpUrl(value),
    'Image URL must be an http(s) URL',
  ),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateBannerSchema = createBannerSchema
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    { message: 'Provide at least one banner field to update' },
  );

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
