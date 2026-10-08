/**
 * fix-demo-user.mjs
 *
 * Diagnoses and repairs the demo@greystar.com user so the client portal works.
 *
 * What it checks:
 *   1. Does demo@greystar.com exist in Supabase auth?
 *   2. Does a Greystar account exist in the accounts table?
 *   3. Does demo@greystar.com exist in the users table with that accountId?
 *   4. Is the Supabase JWT metadata set correctly (role + account_id)?
 *
 * What it fixes automatically:
 *   - Creates the Greystar account in DB if missing
 *   - Inserts/updates the users row to role='client' with the Greystar account_id
 *   - Syncs JWT user_metadata so proxy.ts routing works
 *
 * Usage:
 *   node scripts/fix-demo-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL,
} = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('❌ Missing env vars. Check .env.local for:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('   DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

const DEMO_EMAIL = 'demo@greystar.com';
const DEMO_NAME = 'Demo User';
const ACCOUNT_NAME = 'Greystar Real Estate Partners';

async function main() {
  console.log('🔍 Diagnosing demo user...\n');

  // ── Step 1: Find auth user ──────────────────────────────────────────────
  const { data: { users: authUsers }, error: listErr } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listErr) {
    console.error('❌ Could not list auth users:', listErr.message);
    process.exit(1);
  }

  const authUser = authUsers.find(u => u.email === DEMO_EMAIL);

  if (!authUser) {
    console.error(`❌ ${DEMO_EMAIL} does NOT exist in Supabase auth.`);
    console.error('   → Run scripts/demo-seed.mjs to create the demo user, then re-run this script.');
    await sql.end();
    process.exit(1);
  }

  console.log(`✅ Auth user found: ${authUser.id}`);
  console.log(`   metadata: ${JSON.stringify(authUser.user_metadata)}\n`);

  // ── Step 2: Find or create Greystar account ────────────────────────────
  let [account] = await sql`
    SELECT id, name FROM accounts WHERE name ILIKE ${'%greystar%'} LIMIT 1
  `;

  if (!account) {
    const newId = randomUUID();
    [account] = await sql`
      INSERT INTO accounts (id, name, created_at, updated_at)
      VALUES (${newId}, ${ACCOUNT_NAME}, NOW(), NOW())
      RETURNING id, name
    `;
    console.log(`🆕 Created account: ${account.name} (${account.id})`);
  } else {
    console.log(`✅ Account found: ${account.name} (${account.id})`);
  }

  // ── Step 3: Find or fix the users row ─────────────────────────────────
  const [dbUser] = await sql`
    SELECT id, email, role, account_id FROM users WHERE id = ${authUser.id}
  `;

  if (!dbUser) {
    // User missing from DB — insert it
    await sql`
      INSERT INTO users (id, email, full_name, role, account_id, created_at, updated_at)
      VALUES (
        ${authUser.id},
        ${DEMO_EMAIL},
        ${authUser.user_metadata?.full_name ?? DEMO_NAME},
        'client',
        ${account.id},
        NOW(),
        NOW()
      )
    `;
    console.log(`🆕 Inserted users row for ${DEMO_EMAIL} with account_id=${account.id}`);
  } else if (!dbUser.account_id || dbUser.role !== 'client') {
    // Row exists but data is wrong — fix it
    await sql`
      UPDATE users
      SET role = 'client', account_id = ${account.id}, updated_at = NOW()
      WHERE id = ${authUser.id}
    `;
    console.log(`🔁 Fixed users row: role=client, account_id=${account.id}`);
  } else {
    console.log(`✅ Users row OK: role=${dbUser.role}, account_id=${dbUser.account_id}`);
  }

  // ── Step 4: Sync JWT metadata ──────────────────────────────────────────
  const targetMeta = {
    role: 'client',
    account_id: account.id,
    full_name: authUser.user_metadata?.full_name ?? DEMO_NAME,
  };

  const currentMeta = authUser.user_metadata ?? {};
  const metaOk =
    currentMeta.role === targetMeta.role &&
    currentMeta.account_id === targetMeta.account_id;

  if (!metaOk) {
    const { error: metaErr } = await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: targetMeta,
    });
    if (metaErr) {
      console.error('❌ Failed to update JWT metadata:', metaErr.message);
    } else {
      console.log(`🔁 JWT metadata updated: ${JSON.stringify(targetMeta)}`);
    }
  } else {
    console.log(`✅ JWT metadata already correct`);
  }

  console.log('\n✅ demo@greystar.com is ready. Restart the dev server and log in.');
  await sql.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
