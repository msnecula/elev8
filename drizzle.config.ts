import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Drizzle Kit migrations require a direct connection (not the pooler).
// Use DIRECT_DATABASE_URL if available, otherwise fall back to DATABASE_URL.
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL or DIRECT_DATABASE_URL is required in .env.local\n' +
    'Get it from: Supabase Dashboard → Settings → Database → Direct connection'
  );
}

export default defineConfig({
  schema: './drizzle/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
