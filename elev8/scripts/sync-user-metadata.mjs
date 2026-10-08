/**
 * sync-user-metadata.mjs
 *
 * Syncs Supabase auth user_metadata from the users database table.
 * Run this once to fix users who were created without metadata
 * (e.g. admin accounts, or demo users whose seed didn't set metadata).
 *
 * Usage:
 *   node scripts/sync-user-metadata.mjs
 *
 * Requires: DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Supabase admin client (service role can update auth users)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Direct DB connection to read the users table
const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  console.log('🔄 Syncing user metadata from database → Supabase auth...\n');

  // Fetch all users from the DB
  const dbUsers = await sql`
    SELECT id, email, full_name, role, account_id
    FROM users
    ORDER BY email
  `;

  console.log(`📋 Found ${dbUsers.length} users in the database.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const dbUser of dbUsers) {
    const newMetadata = {
      role: dbUser.role,
      account_id: dbUser.account_id,
      full_name: dbUser.full_name,
    };

    // Fetch current Supabase auth user to compare
    const { data: authUser, error: fetchError } = await supabase.auth.admin.getUserById(dbUser.id);

    if (fetchError || !authUser?.user) {
      console.warn(`  ⚠️  ${dbUser.email}: not found in Supabase auth (${fetchError?.message ?? 'no user'})`);
      errors++;
      continue;
    }

    const currentMeta = authUser.user.user_metadata ?? {};
    const needsUpdate =
      currentMeta.role !== newMetadata.role ||
      currentMeta.account_id !== newMetadata.account_id ||
      currentMeta.full_name !== newMetadata.full_name;

    if (!needsUpdate) {
      console.log(`  ✅ ${dbUser.email}: already up-to-date (role=${dbUser.role})`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(dbUser.id, {
      user_metadata: newMetadata,
    });

    if (updateError) {
      console.error(`  ❌ ${dbUser.email}: failed — ${updateError.message}`);
      errors++;
    } else {
      console.log(
        `  🔁 ${dbUser.email}: updated → role=${dbUser.role}, account_id=${dbUser.account_id ?? 'null'}`
      );
      updated++;
    }
  }

  console.log(`\n📊 Done: ${updated} updated, ${skipped} skipped (already correct), ${errors} errors.`);

  await sql.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
