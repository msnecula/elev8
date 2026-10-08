/**
 * check-demo-data.mjs — Quick diagnostic for demo@greystar.com data
 * Usage: node scripts/check-demo-data.mjs
 */
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  // 1. Auth user
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUser = authUsers.find(u => u.email === 'demo@greystar.com');
  console.log('\n── Auth user ──────────────────────────────────');
  console.log(`  id:       ${authUser?.id ?? 'NOT FOUND'}`);
  console.log(`  metadata: ${JSON.stringify(authUser?.user_metadata)}`);

  // 2. Users table row
  const [dbUser] = await sql`SELECT id, email, role, account_id FROM users WHERE email = 'demo@greystar.com'`;
  console.log('\n── users table ────────────────────────────────');
  console.log(`  account_id: ${dbUser?.account_id ?? 'NULL / NOT FOUND'}`);
  console.log(`  role:       ${dbUser?.role}`);

  // 3. All accounts matching "greystar"
  const accounts = await sql`SELECT id, name FROM accounts WHERE name ILIKE '%greystar%'`;
  console.log('\n── accounts matching "greystar" ───────────────');
  for (const a of accounts) console.log(`  ${a.id}  ${a.name}`);

  // 4. Jobs per account
  const jobCounts = await sql`
    SELECT account_id, COUNT(*) as count FROM jobs WHERE account_id IN (
      SELECT id FROM accounts WHERE name ILIKE '%greystar%'
    ) GROUP BY account_id
  `;
  console.log('\n── jobs per greystar account ──────────────────');
  for (const r of jobCounts) console.log(`  ${r.account_id}  →  ${r.count} jobs`);

  // 5. Verdict
  const userAccountId = dbUser?.account_id;
  const jobsForUser = jobCounts.find(r => r.account_id === userAccountId);
  console.log('\n── verdict ────────────────────────────────────');
  if (!userAccountId) {
    console.log('  ❌ users table has no account_id — run fix-demo-user.mjs');
  } else if (!jobsForUser) {
    console.log(`  ❌ MISMATCH: user account_id=${userAccountId} but jobs are in a different account`);
    console.log('  → Fix: run node scripts/fix-demo-data-mismatch.mjs');
  } else {
    console.log(`  ✅ Looks good — ${jobsForUser.count} jobs for the user's account`);
  }

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
