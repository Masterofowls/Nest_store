import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { validateEnvironment } from './src/config/env.schema';

const env = validateEnvironment(process.env);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: 'require',
  },
});
