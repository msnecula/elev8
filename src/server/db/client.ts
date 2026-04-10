import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';
import { setDefaultResultOrder } from 'dns';

setDefaultResultOrder('ipv4first');

// Always use DATABASE_URL (Session Pooler) — never the direct connection at runtime
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set in .env.local');
}

if (url.includes('db.') && url.includes('.supabase.co')) {
  throw new Error(
    'DATABASE_URL is pointing to the direct connection (db.xxx.supabase.co). ' +
    'Use the Session Pooler URL instead: postgresql://postgres.PROJECTREF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres'
  );
}

// Singleton pattern — survives Next.js hot reloads in dev
const globalForDb = global as unknown as { _pgClient: postgres.Sql | undefined };

function createClient() {
  return postgres(url!, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
}

const client = globalForDb._pgClient ?? createClient();
if (process.env.NODE_ENV !== 'production') {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
