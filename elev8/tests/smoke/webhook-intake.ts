/**
 * Elev8 Comply — End-to-End Smoke Test: Email Intake → AI Parse → Job → Proposal
 *
 * Fires a realistic Cal/OSHA elevator notice at the email-intake webhook, then
 * polls Supabase to verify the full pipeline ran: notice parsed, job created,
 * proposal auto-drafted.
 *
 * Usage:
 *   npx tsx tests/smoke/webhook-intake.ts
 *
 * Required env vars (from .env.local):
 *   EMAIL_INTAKE_WEBHOOK_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   BASE_URL   (default: http://localhost:3000)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL  = process.env.BASE_URL ?? 'http://localhost:3000';
const SECRET    = process.env.EMAIL_INTAKE_WEBHOOK_SECRET;
const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Realistic Cal/OSHA elevator compliance notice ────────────────────────────

const SAMPLE_NOTICE = `
CALIFORNIA DEPARTMENT OF INDUSTRIAL RELATIONS
DIVISION OF OCCUPATIONAL SAFETY AND HEALTH (DOSH)
ELEVATOR UNIT — LOS ANGELES AREA OFFICE

PRELIMINARY ORDER TO COMPLY
Notice No.: DOSH-2026-LA-08421
Date Issued: October 1, 2026

To: Sunset Tower Partners LLC
    1234 Wilshire Blvd, Los Angeles, CA 90017
    Attn: Building Manager

Equipment: Hydraulic passenger elevator, Unit #2
Serial No.: HTK-2019-00441
Permit No.: ELV-12893
Floors Served: Lobby, B1–10

VIOLATIONS FOUND DURING INSPECTION:

1. California Code of Regulations, Title 8, Section 3091 — Category 1 full-load,
   full-speed safety test overdue. Last performed October 2021. Annual test must be
   completed by the compliance deadline.

2. CCR Title 8 Section 3097 — Hydraulic oil buffer has insufficient stroke travel.
   Buffer must be replaced or re-certified before Category 1 test is conducted.

3. CCR Title 8 Section 3098 — Worn door gibs on car door (ground floor). Door
   closure time exceeds 3 seconds. Must be corrected to achieve closure within
   2.5 seconds.

REQUIRED CORRECTIVE ACTIONS:

1. Submit 48-hour advance written notification to DOSH Area Office before the
   Category 1 safety test.
2. Replace hydraulic oil buffer to meet stroke-travel specifications per manufacturer
   and CCR requirements.
3. Replace worn door gibs and adjust door operator speed.
4. Schedule and pass Category 1 full-load/full-speed safety test.
5. Submit certified test results to DOSH within 10 days of test completion.

COMPLIANCE DEADLINE: November 30, 2026

Failure to comply by the deadline may result in equipment shutdown order and
civil penalties up to $15,000 per violation per day.

Inspector: J. Martinez, DOSH Elevator Unit 8
Office: (213) 555-0182 | jmartinez@dir.ca.gov
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

type CheckResult = { label: string; ok: boolean; detail?: string };

async function check(
  label: string,
  fn: () => Promise<boolean | string>,
): Promise<CheckResult> {
  try {
    const result = await fn();
    const ok = result !== false;
    const detail = typeof result === 'string' ? result : undefined;
    console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? `  (${detail})` : ''}`);
    return { label, ok, detail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ${label}  — threw: ${msg}`);
    return { label, ok: false, detail: msg };
  }
}

function supaFetch(path: string): Promise<Response> {
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY!,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔬  Elev8 Comply — End-to-End Smoke Test');
  console.log(`    Target : ${BASE_URL}`);
  console.log(`    Time   : ${new Date().toLocaleString()}\n`);

  // ── Pre-flight ──────────────────────────────────────────────────────────────
  if (!SECRET) {
    console.error('❌  EMAIL_INTAKE_WEBHOOK_SECRET is not set — add it to .env.local');
    process.exit(1);
  }

  const dbEnabled = Boolean(SUPA_URL && SUPA_KEY);
  if (!dbEnabled) {
    console.warn('⚠️   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.');
    console.warn('    DB chain checks will be skipped.\n');
  }

  // ── Step 1: Fire the webhook ────────────────────────────────────────────────
  console.log('Step 1: POST /api/webhooks/email-intake');

  let webhookRes: Response;
  try {
    webhookRes = await fetch(`${BASE_URL}/api/webhooks/email-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': SECRET,
      },
      body: JSON.stringify({
        from: 'j.martinez@dir.ca.gov',
        subject: 'DOSH Preliminary Order to Comply — 1234 Wilshire Blvd',
        text: SAMPLE_NOTICE,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌  Could not reach ${BASE_URL} — is the dev server running?\n  ${msg}`);
    process.exit(1);
  }

  const webhookBody = await webhookRes.json().catch(() => ({})) as Record<string, unknown>;

  const step1Results = await Promise.all([
    check('HTTP 200', async () => webhookRes.status === 200),
    check('Body has noticeId', async () => {
      const id = webhookBody.noticeId;
      return typeof id === 'string' && id.length > 0
        ? id
        : false;
    }),
    check('Body has received:true', async () => webhookBody.received === true),
  ]);

  const noticeId = webhookBody.noticeId as string | undefined;
  if (!noticeId) {
    console.error('\n  Cannot continue without a noticeId. Check the server console for errors.\n');
    process.exit(1);
  }
  console.log(`  noticeId: ${noticeId}\n`);

  if (!dbEnabled) {
    console.log('  (Skipping DB checks — no Supabase credentials)\n');
    summarise([...step1Results]);
    return;
  }

  // ── Step 2: Wait for background AI parse (next.js after()) ─────────────────
  console.log('Step 2: Polling for AI parse completion (up to 45s)…');

  type NoticeRow = { status: string; urgency: string; parsed_data: Record<string, unknown> | null; parse_error: string | null };
  let notice: NoticeRow | null = null;
  const POLL_MAX = 18;

  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(2500);
    const r = await supaFetch(
      `notices?id=eq.${noticeId}&select=status,urgency,parsed_data,parse_error`
    );
    const rows = await r.json() as NoticeRow[];
    notice = rows[0] ?? null;
    const s = notice?.status;
    if (s === 'parsed' || s === 'parse_failed') break;
    process.stdout.write(i === 0 ? '  waiting' : '.');
  }
  console.log('');

  const step2Results = await Promise.all([
    check('Notice status is "parsed"', async () => {
      if (notice?.status === 'parsed') return true;
      if (notice?.status === 'parse_failed') {
        const msg = notice.parse_error ?? 'no error detail';
        console.log(`\n    Parse error: ${msg}`);
        console.log('    Is OPENAI_API_KEY set in .env.local?');
      }
      return false;
    }),
    check('Notice has urgency', async () => !!notice?.urgency && notice.urgency),
    check('parsedData.complianceDeadline is set', async () => {
      const pd = notice?.parsed_data;
      const dl = pd?.complianceDeadline as string | undefined;
      return dl ? dl : false;
    }),
    check('parsedData.buildingType is set', async () => {
      const bt = notice?.parsed_data?.buildingType as string | undefined;
      return bt ? bt : false;
    }),
  ]);

  if (notice?.status !== 'parsed') {
    summarise([...step1Results, ...step2Results]);
    process.exit(1);
  }
  console.log('');

  // ── Step 3: Job created from notice ────────────────────────────────────────
  console.log('Step 3: Verify job was created');

  type JobRow = { id: string; stage: string; title: string; urgency: string; next_action_date: string | null };
  const jobsRes = await supaFetch(
    `jobs?notice_id=eq.${noticeId}&select=id,stage,title,urgency,next_action_date`
  );
  const jobRows = await jobsRes.json() as JobRow[];
  const job = jobRows[0] ?? null;

  const step3Results = await Promise.all([
    check('Job row exists', async () => !!job),
    check('Job has title', async () => job?.title ? job.title : false),
    check('Job urgency matches notice', async () => {
      return job?.urgency === notice?.urgency
        ? `${job?.urgency}`
        : false;
    }),
    check('Job stage is "under_review" or "proposal_drafted"', async () => {
      const s = job?.stage;
      return (s === 'under_review' || s === 'proposal_drafted') ? s : false;
    }),
    check('next_action_date is populated (complianceDeadline fix)', async () => {
      return job?.next_action_date ? job.next_action_date : false;
    }),
  ]);

  console.log(`  jobId: ${job?.id ?? '(none)'}\n`);

  // ── Step 4: Proposal auto-drafted ──────────────────────────────────────────
  console.log('Step 4: Verify proposal was auto-drafted');

  type ProposalRow = { id: string; status: string; title: string; total_amount: string | null; version: number };
  let proposal: ProposalRow | null = null;

  if (job?.id) {
    const propRes = await supaFetch(
      `proposals?job_id=eq.${job.id}&select=id,status,title,total_amount,version&order=version.asc`
    );
    const propRows = await propRes.json() as ProposalRow[];
    proposal = propRows[0] ?? null;
  }

  const step4Results = await Promise.all([
    check('Proposal row exists', async () => !!proposal),
    check('Proposal status is "draft"', async () => proposal?.status === 'draft' ? 'draft' : false),
    check('Proposal has title', async () => proposal?.title ? proposal.title : false),
    check('Proposal totalAmount > 0', async () => {
      const amt = Number(proposal?.total_amount ?? 0);
      return amt > 0 ? `$${amt.toLocaleString()}` : false;
    }),
  ]);

  console.log(`  proposalId: ${proposal?.id ?? '(none)'}\n`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  summarise([...step1Results, ...step2Results, ...step3Results, ...step4Results]);
}

function summarise(results: CheckResult[]) {
  const passed = results.filter(r => r.ok).length;
  const total  = results.length;
  const failed = results.filter(r => !r.ok);

  console.log('─'.repeat(50));
  console.log(`Smoke test: ${passed}/${total} checks passed`);
  if (failed.length) {
    console.log('\nFailed checks:');
    failed.forEach(f => console.log(`  • ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
  }
  console.log('─'.repeat(50) + '\n');

  if (passed < total) process.exit(1);
}

main().catch(err => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
