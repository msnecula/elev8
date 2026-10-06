/**
 * test-sms.mjs — Send a test SMS via Twilio to verify credentials and number.
 * Zero dependencies. Run with: node scripts/test-sms.mjs
 *
 * Set TO_NUMBER below to your own mobile number before running.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env.local');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] ??= val;
    }
  } catch {
    // env vars may already be set in the shell
  }
}

loadEnv();

// ─── Config ───────────────────────────────────────────────────────────────────
const ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER   = process.env.TWILIO_FROM_NUMBER ?? '+12139960118';

// ✏️  Set this to your mobile number (E.164 format, e.g. +13105550100)
const TO_NUMBER = process.env.TEST_SMS_TO ?? '';

const MESSAGE = `Elev8: Test message from Precision Lift Co. — SMS is configured and working. Reply STOP to opt out.`;

// ─── Validate ─────────────────────────────────────────────────────────────────
if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error('❌  Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env.local');
  process.exit(1);
}

if (!TO_NUMBER) {
  console.error('❌  Set TO_NUMBER in this script or run with: TEST_SMS_TO=+1XXXXXXXXXX node scripts/test-sms.mjs');
  process.exit(1);
}

// ─── Send ─────────────────────────────────────────────────────────────────────
const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

const body = new URLSearchParams({
  To:   TO_NUMBER,
  From: FROM_NUMBER,
  Body: MESSAGE,
});

console.log(`📤  Sending SMS...`);
console.log(`    From: ${FROM_NUMBER}`);
console.log(`    To:   ${TO_NUMBER}`);
console.log(`    Msg:  ${MESSAGE}\n`);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: body.toString(),
});

const data = await res.json();

if (res.ok) {
  console.log(`✅  SMS sent! SID: ${data.sid}`);
  console.log(`    Status: ${data.status}`);
} else {
  console.error(`❌  Twilio error ${data.code}: ${data.message}`);
  if (data.more_info) console.error(`    More info: ${data.more_info}`);
  process.exit(1);
}
