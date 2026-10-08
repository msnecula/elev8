/**
 * fix-demo-data-mismatch.mjs
 *
 * Fixes the account_id mismatch for demo@greystar.com.
 * Points the user to the "Greystar Real Estate Partners" account (where the jobs live).
 *
 * Usage: node scripts/fix-demo-data-mismatch.mjs
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
  // Find the account that actually has the jobs
  const [jobAccount] = await sql`
    SELECT a.id, a.name, COUNT(j.id) as job_count
    FROM accounts a
    JOIN jobs j ON j.account_id = a.id
    WHERE a.name ILIKE '%greystar%'
    GROUP BY a.id, a.name
    ORDER BY job_count DESC
    LIMIT 1
  `;

  if (!jobAccount) {
    console.error('❌ No Greystar account with jobs found. Run demo-seed.mjs first.');
    process.exit(1);
  }

  console.log(`\n✅ Target account: "${jobAccount.name}" (${jobAccount.id}) — ${jobAccount.job_count} jobs`);

  // Update users table
  const result = await sql`
    UPDATE users
    SET account_id = ${jobAccount.id}, updated_at = NOW()
    WHERE email = 'demo@greystar.com'
    RETURNING id, email
  `;

  if (result.length === 0) {
    console.error('❌ demo@greystar.com not found in users table.');
    process.exit(1);
  }
  const userId = result[0].id;
  console.log(`✅ users table: account_id updated → ${jobAccount.id}`);

  // Update Supabase JWT metadata
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: 'client',
      account_id: jobAccount.id,
      full_name: 'Alex Ramirez',
    },
  });

  if (error) {
    console.error('❌ JWT metadata update failed:', error.message);
  } else {
    console.log(`✅ JWT metadata: account_id synced`);
  }

  console.log('\n✅ Done. Restart dev server and log in — jobs will appear.');
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
