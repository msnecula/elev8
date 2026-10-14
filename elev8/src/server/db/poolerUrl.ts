// Supabase's shared pooler (Supavisor) serves two modes on the same host:
//   :5432  session mode     — one Postgres connection per client, capped at pool_size (15)
//   :6543  transaction mode — clients share Postgres connections between transactions
// Every serverless instance holds its own clients, so session mode runs out within a
// few warm instances and every query fails with EMAXCONNSESSION. The app's runtime pool
// therefore always connects in transaction mode (client.ts sets prepare: false for it).
// Direct connections and non-Supabase hosts are left untouched.

const SUPABASE_POOLER_HOST_SUFFIX = '.pooler.supabase.com';
const SESSION_MODE_PORT = '5432';
const TRANSACTION_MODE_PORT = '6543';

export function toTransactionPoolerUrl(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  const isSupabasePooler = url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX);
  const isSessionMode = url.port === '' || url.port === SESSION_MODE_PORT;
  if (!isSupabasePooler || !isSessionMode) return databaseUrl;

  url.port = TRANSACTION_MODE_PORT;
  return url.toString();
}
