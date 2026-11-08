import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { testEnvSchema } from './src/config/test-env.schema';

const result = testEnvSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    'Invalid TEST_DATABASE_URL: expected local store_test database on port 5432',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: result.data.TEST_DATABASE_URL,
    ssl: false,
  },
});
