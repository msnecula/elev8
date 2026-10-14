import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';
import { setDefaultResultOrder } from 'dns';
import { toTransactionPoolerUrl } from './poolerUrl';

setDefaultResultOrder('ipv4first');

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set in .env.local');
}

if (url.includes('db.') && url.includes('.supabase.co') && !url.includes('pooler')) {
  console.warn('[db] WARNING: DATABASE_URL appears to be a direct connection. Use the Transaction Pooler URL instead.');
}

const globalForDb = global as unknown as { _pgClient: postgres.Sql | undefined };

function createClient() {
  return postgres(toTransactionPoolerUrl(url!), {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
}

// One pool per server process: survives dev HMR reloads, and in production keeps any
// duplicate copies of this module in the server bundles from opening extra connections.
const client = globalForDb._pgClient ?? createClient();
globalForDb._pgClient = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
