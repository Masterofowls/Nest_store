import { z } from 'zod';

export const testEnvSchema = z.object({
  TEST_DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => {
        if (!URL.canParse(value)) {
          return false;
        }

        const url = new URL(value);

        return (
          ['postgres:', 'postgresql:'].includes(url.protocol) &&
          ['localhost', '127.0.0.1'].includes(url.hostname) &&
          ['', '5432'].includes(url.port) &&
          url.pathname === '/store_test' &&
          url.search === '' &&
          url.hash === ''
        );
      },
      {
        message:
          'TEST_DATABASE_URL must target local PostgreSQL on port 5432, database store_test',
      },
    ),
});
