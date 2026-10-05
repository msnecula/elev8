#!/usr/bin/env node
/**
 * scripts/test-email.mjs — Test Resend email delivery
 * Zero npm dependencies — uses native fetch only.
 *
 * Run: node --dns-result-order=ipv4first scripts/test-email.mjs
 *
 * With onboarding@resend.dev as FROM, Resend only delivers to
 * the email address your Resend account is registered with.
 * Change TO_EMAIL below to that address if needed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load .env.local
function loadEnv(p) {
  try {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}
loadEnv(resolve(ROOT, '.env.local'));
loadEnv(resolve(ROOT, '.env'));

const API_KEY  = process.env.RESEND_API_KEY ?? '';
const FROM     = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const FROM_NAME = process.env.RESEND_FROM_NAME ?? 'Elev8 Comply';

// ── CHANGE THIS to your Resend account email if needed ──
// With onboarding@resend.dev, Resend only sends to your own account email.
// Once you add a domain in Resend, you can send to any address.
const TO_EMAIL = process.env.TEST_EMAIL ?? 'msnecula@gmail.com';

if (!API_KEY) {
  console.error('❌  RESEND_API_KEY not found in .env.local');
  process.exit(1);
}

console.log('\n📧  Testing Resend email...');
console.log(`  From:   ${FROM_NAME} <${FROM}>`);
console.log(`  To:     ${TO_EMAIL}`);
console.log(`  API Key: ${API_KEY.slice(0, 12)}…\n`);

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#111827;background:#fff;">
  <div style="border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:32px;">
    <span style="font-size:22px;font-weight:700;color:#2563eb;">Elev8 Comply</span>
  </div>
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;">✅ Email delivery confirmed</h1>
  <p style="font-size:15px;line-height:1.6;color:#374151;">
    This is a test email from <strong>Elev8 Comply</strong>.
    If you received this, your Resend integration is working correctly.
  </p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0;">
    <p style="margin:0;font-size:14px;color:#166534;">
      <strong>What this confirms:</strong><br>
      • RESEND_API_KEY is valid<br>
      • Email delivery to this address works<br>
      • Elev8 Comply can send notifications
    </p>
  </div>
  <p style="font-size:14px;color:#6b7280;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
    Sent from Elev8 Comply — California Elevator Compliance Platform<br>
    Precision Lift Co.
  </p>
</body>
</html>`;

try {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM}>`,
      to: [TO_EMAIL],
      subject: '✅ Elev8 Comply — Email Test',
      html,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error('❌  Resend API error:');
    console.error('   Status:', res.status);
    console.error('   Name:  ', json.name ?? '—');
    console.error('   Message:', json.message ?? JSON.stringify(json));

    if (res.status === 403 || json.message?.includes('domain')) {
      console.log('\n💡  This usually means you need to verify a sending domain in Resend.');
      console.log('   With onboarding@resend.dev you can ONLY send to your Resend account email.');
      console.log('   → Go to https://resend.com/domains and add your domain.');
    }
    process.exit(1);
  }

  console.log('✅  Email sent successfully!');
  console.log('   Email ID:', json.id);
  console.log(`\n   Check your inbox at ${TO_EMAIL}`);
  console.log('   (Also check spam if you don\'t see it)\n');

} catch (err) {
  console.error('❌  Network error:', err.message);
  if (err.cause) console.error('   Cause:', err.cause?.message ?? err.cause);
  process.exit(1);
}
