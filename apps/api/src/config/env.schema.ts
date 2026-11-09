import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith('postgresql://') || value.startsWith('postgres://'),
        { message: 'DATABASE_URL must use postgres:// or postgresql://' },
      ),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z
      .url()
      .refine(
        (value) => value.startsWith('http://') || value.startsWith('https://'),
        { message: 'BETTER_AUTH_URL must use http:// or https://' },
      )
      .refine(
        (value) =>
          URL.canParse(value) && !new URL(value).hostname.includes('*'),
        { message: 'BETTER_AUTH_URL must not contain a wildcard hostname' },
      ),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .refine((value) => value === '', {
        message:
          'Use TRUSTED_FRONTEND_ORIGIN instead of BETTER_AUTH_TRUSTED_ORIGINS',
      })
      .optional(),
    TRUSTED_FRONTEND_ORIGIN: z
      .string()
      .refine(
        (value) => {
          if (
            !/^https?:\/\/[^\s\\/?#@*]+\/?$/i.test(value) ||
            !URL.canParse(value)
          ) {
            return false;
          }
          const url = new URL(value);
          return (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            !url.hostname.includes('*') &&
            url.href === `${url.origin}/`
          );
        },
        {
          message:
            'TRUSTED_FRONTEND_ORIGIN must be an HTTP or HTTPS origin without credentials, path, query, fragment, or wildcard',
        },
      )
      .transform((value) => new URL(value).origin)
      .optional(),
    SUPABASE_URL: z
      .url()
      .refine(
        (value) => value.startsWith('https://') || value.startsWith('http://'),
        { message: 'SUPABASE_URL must use http:// or https://' },
      )
      .optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    SUPABASE_STORAGE_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
      .optional(),
  })
  .superRefine((env, context) => {
    if (Boolean(env.SUPABASE_URL) !== Boolean(env.SUPABASE_SERVICE_ROLE_KEY)) {
      context.addIssue({
        code: 'custom',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message:
          'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together',
      });
    }
  });

export function validateEnvironment(input: unknown): Environment {
  const result = envSchema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration: ${details}`);
}

export type Environment = z.infer<typeof envSchema>;
