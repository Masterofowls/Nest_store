import { z } from 'zod';

export const envSchema = z.object({
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
    ),
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
