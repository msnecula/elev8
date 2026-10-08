#!/usr/bin/env node
/**
 * scripts/demo-seed.mjs — Greystar Demo Data Seed
 *
 * Populates the database with a realistic compliance pipeline for a Greystar demo.
 * Safe to re-run: skips rows that already exist (idempotent on account name).
 *
 * Run: node --dns-result-order=ipv4first scripts/demo-seed.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* absent — rely on actual env vars */ }
}
loadEnv(resolve(ROOT, '.env.local'));
loadEnv(resolve(ROOT, '.env'));

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const H = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function rest(method, path, body, extra = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...H, ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = typeof json === 'object' ? (json?.message ?? text) : text;
    throw new Error(`[${res.status}] ${path} — ${msg}`);
  }
  return json;
}

// Supabase REST helpers
const db   = (table) => `/rest/v1/${table}`;
const auth = (path)  => `/auth/v1${path}`;

async function insert(table, rows, upsertOn) {
  const extra = upsertOn
    ? { Prefer: `resolution=ignore-duplicates,return=representation` }
    : { Prefer: 'return=representation' };
  const data = await rest('POST', db(table), Array.isArray(rows) ? rows : [rows], extra);
  return Array.isArray(data) ? data : [data];
}

async function query(table, filters = '') {
  return rest('GET', `${db(table)}?${filters}`);
}

async function createAuthUser(email, password, fullName, role) {
  try {
    const data = await rest('POST', auth('/admin/users'), {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return data.id;
  } catch (e) {
    if (e.message.includes('already') || e.message.includes('duplicate')) {
      const users = await rest('GET', auth('/admin/users'));
      const found = (users.users ?? users).find(u => u.email === email);
      if (found) return found.id;
    }
    throw e;
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const now        = new Date();
const daysAgo    = (n) => new Date(now - n * 864e5).toISOString();
const daysFromNow = (n) => new Date(+now + n * 864e5).toISOString();
const dateOnly   = (iso) => iso.split('T')[0];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Elev8 Comply — Greystar Demo Seed\n');

  // ── 1. Account ──────────────────────────────────────────────────────────────
  console.log('  📋  Account…');
  let [account] = await query('accounts', `name=eq.Greystar Real Estate Partners&limit=1`);
  if (!account) {
    [account] = await insert('accounts', {
      name:    'Greystar Real Estate Partners',
      email:   'compliance@greystar.com',
      phone:   '(713) 425-5000',
      address: '655 New York Ave NW Suite 600',
      city:    'Washington', state: 'DC', zip: '20001',
      notes:   'International real estate developer & manager. Southern California portfolio — demo account.',
    });
  }
  const accountId = account.id;
  console.log(`     ✓  Account: ${account.name} (${accountId})`);

  // ── 2. Properties ────────────────────────────────────────────────────────────
  console.log('\n  🏢  Properties…');
  const propDefs = [
    {
      name: 'The Alexan at Beverly Hills',
      address: '8601 Wilshire Blvd', city: 'Beverly Hills', state: 'CA', zip: '90211',
      building_type: 'residential', elevator_count: 4,
      notes: '321-unit luxury high-rise. 4 passenger elevators (2 traction, 2 hydraulic). Built 2019.',
    },
    {
      name: 'Greystar Commons at DTLA',
      address: '1000 S Flower St', city: 'Los Angeles', state: 'CA', zip: '90015',
      building_type: 'mixed_use', elevator_count: 6,
      notes: '280-unit mixed-use tower. 6 elevators (4 traction, 2 service). Built 2021. Adjacent retail.',
    },
    {
      name: 'Modera Playa Vista',
      address: '12501 Bluff Creek Dr', city: 'Los Angeles', state: 'CA', zip: '90094',
      building_type: 'residential', elevator_count: 3,
      notes: '220-unit luxury apartment complex. 3 traction elevators. Built 2020. Tech corridor.',
    },
  ];

  const props = [];
  for (const p of propDefs) {
    let [existing] = await query('properties', `name=eq.${encodeURIComponent(p.name)}&account_id=eq.${accountId}&limit=1`);
    if (!existing) {
      [existing] = await insert('properties', { ...p, account_id: accountId });
    }
    props.push(existing);
    console.log(`     ✓  ${existing.name}`);
  }
  const [alexan, dtla, playa] = props;

  // ── 3. Demo Client User (Greystar portal login) ──────────────────────────────
  console.log('\n  👤  Demo users…');
  const clientAuthId = await createAuthUser(
    'demo@greystar.com', 'Greystar-Demo-2026!',
    'Alex Ramirez', 'client'
  );
  // Upsert into users table (id must match auth UUID)
  await rest('POST', db('users'), [{
    id: clientAuthId,
    email: 'demo@greystar.com',
    full_name: 'Alex Ramirez',
    role: 'client',
    account_id: accountId,
    phone: '(213) 555-0182',
    is_active: true,
  }], { Prefer: 'resolution=ignore-duplicates,return=representation' });
  console.log('     ✓  demo@greystar.com / Greystar-Demo-2026! (client portal)');

  // ── 4. Get or create an admin user ID for reviewer fields ───────────────────
  const adminUsers = await query('users', `role=eq.admin&limit=1`);
  const adminId = adminUsers[0]?.id ?? null;

  // ── 5. Helper — build parsedData ─────────────────────────────────────────────
  function parsedData(overrides) {
    return {
      documentType: 'Cal/OSHA Preliminary Order',
      clientCompany: 'Greystar Real Estate Partners',
      buildingType: 'residential',
      elevatorType: 'traction',
      serialNumber: '',
      floorsServed: '12',
      unitsAffected: 1,
      safetyTestsRequired: ['Annual Safety Inspection'],
      advanceNotificationRequired: true,
      advanceNotificationHours: 48,
      advanceNotificationRecipients: ['Cal/OSHA District Office', 'Building Owner', 'Property Manager'],
      additionalMaintenanceRequirements: [],
      actionPlan: [],
      inspectionDate: dateOnly(daysAgo(30)),
      stateDeadline: null,
      detailedScope: '',
      violationItems: [],
      workType: 'inspection',
      requiredSkillTag: 'traction',
      estimatedDurationHours: 4,
      estimatedLaborHours: 4,
      estimatedMaterials: 0,
      fortyEightHourRequired: true,
      complianceCoordinationRequired: false,
      missingInformation: [],
      parseConfidence: 0.95,
      ...overrides,
    };
  }

  // ── 6. Notices & Jobs ────────────────────────────────────────────────────────
  console.log('\n  📄  Notices & Jobs…');

  const jobs = [];

  async function createNoticeAndJob({
    property, equipmentId, elevatorType, propertyAddress, propertyName,
    noticeUrgency, jobStage, jobUrgency, title,
    requiredWorkSummary, safetyTestsRequired, violationItems,
    complianceDeadlineOffset, inspectionDaysAgo,
    estimatedLabor, estimatedMaterials, workType, requiredSkillTag,
    fortyEightHourRequired = true, complianceCoordinationRequired = false,
  }) {
    const complianceDeadline = dateOnly(daysFromNow(complianceDeadlineOffset));
    const inspectionDate = dateOnly(daysAgo(inspectionDaysAgo));

    // Insert notice
    const [notice] = await insert('notices', {
      account_id: accountId,
      property_id: property.id,
      intake_method: 'email_intake',
      status: 'parsed',
      file_name: `Cal-OSHA-PO-${equipmentId}-${Date.now()}.pdf`,
      file_size: Math.floor(Math.random() * 200000) + 50000,
      mime_type: 'application/pdf',
      urgency: noticeUrgency,
      state_deadline: new Date(complianceDeadline + 'T17:00:00Z').toISOString(),
      parsed_data: parsedData({
        propertyName,
        propertyAddress,
        equipmentId,
        elevatorType,
        requiredWorkSummary,
        safetyTestsRequired,
        violationItems: violationItems ?? [],
        complianceDeadline,
        inspectionDate,
        estimatedLaborHours: estimatedLabor,
        estimatedMaterials,
        workType,
        requiredSkillTag,
        fortyEightHourRequired,
        complianceCoordinationRequired,
        urgency: noticeUrgency,
      }),
    });

    // Next action date
    const nextActionDate = complianceDeadlineOffset < 7
      ? dateOnly(now.toISOString())  // overdue or urgent — action today
      : dateOnly(daysFromNow(Math.min(complianceDeadlineOffset - 5, 14)));

    // Insert job
    const [job] = await insert('jobs', {
      notice_id: notice.id,
      property_id: property.id,
      account_id: accountId,
      assigned_reviewer_id: adminId,
      stage: jobStage,
      urgency: jobUrgency,
      title,
      next_action_date: nextActionDate,
      risk_flags: fortyEightHourRequired ? ['48hr_notice_required'] : [],
      building_type: property.building_type,
      required_skill_tag: requiredSkillTag,
      estimated_duration_hours: String(estimatedLabor),
      estimated_labor_hours: String(estimatedLabor),
      estimated_materials_cost: String(estimatedMaterials),
      compliance_coordination_required: complianceCoordinationRequired,
      forty_eight_hour_required: fortyEightHourRequired,
      internal_notes: `Demo job — ${propertyName}, State ID ${equipmentId}`,
    });

    console.log(`     ✓  [${jobStage.toUpperCase().padEnd(18)}] ${title}`);
    return { notice, job };
  }

  // ── Job 1: notice_received / CRITICAL ────────────────────────────────────────
  const j1 = await createNoticeAndJob({
    property: alexan, propertyName: alexan.name, propertyAddress: '8601 Wilshire Blvd, Beverly Hills, CA 90211',
    equipmentId: 'EL-28941', elevatorType: 'hydraulic',
    noticeUrgency: 'critical', jobStage: 'notice_received', jobUrgency: 'critical',
    title: 'The Alexan BH — EL-28941 — 5-Year Hydraulic Test (OVERDUE)',
    requiredWorkSummary: '5-Year full load hydraulic system pressure test and complete safety inspection. Compliance deadline exceeded — immediate scheduling required.',
    safetyTestsRequired: ['5-Year Hydraulic Pressure Test', 'Full Load Test', 'Emergency Operation Test'],
    violationItems: ['5-Year hydraulic test overdue', 'Last inspection: 5 years 2 months ago', 'Pressure relief valve certification expired'],
    complianceDeadlineOffset: -3, // 3 days overdue
    inspectionDaysAgo: 45,
    estimatedLabor: 6, estimatedMaterials: 850,
    workType: 'periodic_test', requiredSkillTag: 'hydraulic',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // ── Job 2: under_review / HIGH ────────────────────────────────────────────────
  const j2 = await createNoticeAndJob({
    property: alexan, propertyName: alexan.name, propertyAddress: '8601 Wilshire Blvd, Beverly Hills, CA 90211',
    equipmentId: 'EL-28942', elevatorType: 'traction',
    noticeUrgency: 'high', jobStage: 'under_review', jobUrgency: 'high',
    title: 'The Alexan BH — EL-28942 — Annual Traction Safety Test',
    requiredWorkSummary: 'Annual traction elevator safety inspection per CCR Title 8. Car safety governor test, buffer test, and brake test required.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Governor/Safety Test', 'Buffer Test', 'Brake Test'],
    violationItems: ['Annual safety test overdue by 22 days'],
    complianceDeadlineOffset: 14,
    inspectionDaysAgo: 22,
    estimatedLabor: 4, estimatedMaterials: 0,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // ── Job 3: proposal_drafted / MEDIUM ─────────────────────────────────────────
  const j3 = await createNoticeAndJob({
    property: dtla, propertyName: dtla.name, propertyAddress: '1000 S Flower St, Los Angeles, CA 90015',
    equipmentId: 'EL-51203', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'proposal_drafted', jobUrgency: 'medium',
    title: 'Greystar DTLA — EL-51203 — Annual Inspection & Adjustment',
    requiredWorkSummary: 'Annual safety inspection and adjustment of traction elevator. Minor leveling issues noted in Cal/OSHA preliminary order.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Leveling Accuracy Test'],
    violationItems: ['Door reopening device adjustment needed', 'Floor-level accuracy outside tolerance (>¾ inch)'],
    complianceDeadlineOffset: 28,
    inspectionDaysAgo: 15,
    estimatedLabor: 3, estimatedMaterials: 120,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // ── Job 4: proposal_sent / MEDIUM ────────────────────────────────────────────
  const j4 = await createNoticeAndJob({
    property: dtla, propertyName: dtla.name, propertyAddress: '1000 S Flower St, Los Angeles, CA 90015',
    equipmentId: 'EL-51207', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'proposal_sent', jobUrgency: 'medium',
    title: 'Greystar DTLA — EL-51207 — Load Test (Freight/Service Elevator)',
    requiredWorkSummary: 'Full load test required for freight/service elevator per Cal/OSHA order. Rated capacity verification.',
    safetyTestsRequired: ['Full Load Test', 'Safety Test', 'Annual Inspection'],
    violationItems: ['Freight elevator load test not performed within required interval'],
    complianceDeadlineOffset: 35,
    inspectionDaysAgo: 10,
    estimatedLabor: 5, estimatedMaterials: 200,
    workType: 'load_test', requiredSkillTag: 'traction',
    fortyEightHourRequired: true,
  });

  // ── Job 5: approved / HIGH ────────────────────────────────────────────────────
  const j5 = await createNoticeAndJob({
    property: playa, propertyName: playa.name, propertyAddress: '12501 Bluff Creek Dr, Los Angeles, CA 90094',
    equipmentId: 'EL-67834', elevatorType: 'traction',
    noticeUrgency: 'high', jobStage: 'approved', jobUrgency: 'high',
    title: 'Modera Playa Vista — EL-67834 — Post-Repair Reinspection',
    requiredWorkSummary: 'Post-repair reinspection following emergency stop mechanism replacement. Cal/OSHA clearance required before return to service.',
    safetyTestsRequired: ['Post-Repair Reinspection', 'Emergency Stop Test', 'Full Safety Certification'],
    violationItems: ['Emergency stop mechanism replaced — reinspection required per CCR §3001', 'Elevator out of service pending clearance'],
    complianceDeadlineOffset: 10,
    inspectionDaysAgo: 8,
    estimatedLabor: 4, estimatedMaterials: 0,
    workType: 'reinspection', requiredSkillTag: 'traction',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // ── Job 6: scheduled / MEDIUM ────────────────────────────────────────────────
  const j6 = await createNoticeAndJob({
    property: playa, propertyName: playa.name, propertyAddress: '12501 Bluff Creek Dr, Los Angeles, CA 90094',
    equipmentId: 'EL-67835', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'scheduled', jobUrgency: 'medium',
    title: 'Modera Playa Vista — EL-67835 — Annual Safety Inspection',
    requiredWorkSummary: 'Annual safety inspection per CCR Title 8 requirements. All safety systems, brakes, and emergency devices.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Brake Test'],
    violationItems: [],
    complianceDeadlineOffset: 45,
    inspectionDaysAgo: 5,
    estimatedLabor: 3, estimatedMaterials: 0,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // ── Job 7: in_progress / HIGH ─────────────────────────────────────────────────
  const j7 = await createNoticeAndJob({
    property: playa, propertyName: playa.name, propertyAddress: '12501 Bluff Creek Dr, Los Angeles, CA 90094',
    equipmentId: 'EL-67836', elevatorType: 'traction',
    noticeUrgency: 'high', jobStage: 'in_progress', jobUrgency: 'high',
    title: 'Modera Playa Vista — EL-67836 — Suspension Means Replacement',
    requiredWorkSummary: 'Suspension wire rope replacement and retensioning. Cal/OSHA notification form required post-completion.',
    safetyTestsRequired: ['Suspension Means Safety Test', 'Post-Replacement Inspection'],
    violationItems: ['Suspension wire rope at minimum discard diameter', 'Safety factor below 12:1 per CCR §3027'],
    complianceDeadlineOffset: 7,
    inspectionDaysAgo: 12,
    estimatedLabor: 8, estimatedMaterials: 3200,
    workType: 'repair', requiredSkillTag: 'traction',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // ── 7. Proposals ─────────────────────────────────────────────────────────────
  console.log('\n  📝  Proposals…');

  function buildLineItems(laborHours, materialsCost, workTitle) {
    const items = [
      { id: randomUUID(), description: `${workTitle} — Labor (CCCM Certified Mechanic)`, quantity: laborHours, unit: 'hr', unitPrice: 175, total: laborHours * 175 },
      { id: randomUUID(), description: 'Cal/OSHA Permit & Documentation Fee', quantity: 1, unit: 'ea', unitPrice: 150, total: 150 },
    ];
    if (materialsCost > 0) {
      items.push({ id: randomUUID(), description: 'Materials & Parts', quantity: 1, unit: 'lot', unitPrice: materialsCost, total: materialsCost });
    }
    items.push({ id: randomUUID(), description: 'Compliance Coordination & 48-Hour Notice Processing', quantity: 1, unit: 'ea', unitPrice: 95, total: 95 });
    return items;
  }

  const proposalDefs = [
    // Job 3 — draft (needs review before sending)
    { job: j3.job, status: 'draft', sentAt: null, approvedAt: null,
      title: 'Proposal — Annual Inspection & Adjustment — EL-51203',
      body: `Dear Greystar Real Estate Partners,\n\nThank you for choosing Precision Lift Co. for your elevator compliance needs. Please find our proposal for the annual safety inspection and adjustment of elevator EL-51203 at Greystar Commons at DTLA.\n\nOur team of Cal/OSHA certified mechanics will perform all required tests per CCR Title 8 regulations and submit all necessary documentation to the relevant authorities.\n\nThis proposal is valid for 30 days from the date of issue.`,
      laborHours: 3, materialsCost: 120, workTitle: 'Annual Safety Inspection & Adjustment' },

    // Job 4 — sent (awaiting client approval)
    { job: j4.job, status: 'sent', sentAt: daysAgo(4), approvedAt: null,
      title: 'Proposal — Full Load Test (Freight Elevator) — EL-51207',
      body: `Dear Greystar Real Estate Partners,\n\nPlease find our proposal for the full load test of the freight elevator EL-51207 at Greystar Commons at DTLA.\n\nWe will coordinate with Cal/OSHA's district office and provide 48-hour advance written notice as required by California regulations.\n\nWe look forward to your approval to proceed.`,
      laborHours: 5, materialsCost: 200, workTitle: 'Full Load Test & Annual Inspection' },

    // Job 5 — approved
    { job: j5.job, status: 'approved', sentAt: daysAgo(12), approvedAt: daysAgo(9),
      title: 'Proposal — Post-Repair Reinspection — EL-67834',
      body: `Dear Greystar Real Estate Partners,\n\nThis proposal covers the post-repair reinspection for elevator EL-67834 at Modera Playa Vista following the emergency stop mechanism replacement.\n\nThe inspection will be coordinated with the Cal/OSHA district office to ensure clearance for return to service.\n\n⚠ Note: This elevator is currently out of service. Expedited scheduling is strongly recommended.`,
      laborHours: 4, materialsCost: 0, workTitle: 'Post-Repair Reinspection' },

    // Job 6 — approved (scheduled)
    { job: j6.job, status: 'approved', sentAt: daysAgo(20), approvedAt: daysAgo(17),
      title: 'Proposal — Annual Safety Inspection — EL-67835',
      body: `Dear Greystar Real Estate Partners,\n\nThis proposal covers the annual safety inspection for elevator EL-67835 at Modera Playa Vista.\n\nAll work will be performed per CCR Title 8 requirements by our Cal/OSHA certified mechanics.`,
      laborHours: 3, materialsCost: 0, workTitle: 'Annual Safety Inspection' },

    // Job 7 — approved (in progress)
    { job: j7.job, status: 'approved', sentAt: daysAgo(18), approvedAt: daysAgo(15),
      title: 'Proposal — Suspension Means Replacement — EL-67836',
      body: `Dear Greystar Real Estate Partners,\n\nThis proposal covers the full suspension wire rope replacement and retensioning for elevator EL-67836 at Modera Playa Vista.\n\nThis is a safety-critical repair. Our team will complete the replacement, perform all required post-repair safety tests, and file the required Cal/OSHA suspension means notification form upon completion.`,
      laborHours: 8, materialsCost: 3200, workTitle: 'Suspension Means Replacement & Safety Testing' },
  ];

  const proposalIds = {};
  for (const p of proposalDefs) {
    const lineItems = buildLineItems(p.laborHours, p.materialsCost, p.workTitle);
    const total = lineItems.reduce((s, i) => s + i.total, 0);
    const [prop] = await insert('proposals', {
      job_id: p.job.id,
      drafted_by: adminId,
      approved_by: p.approvedAt ? adminId : null,
      status: p.status,
      title: p.title,
      body: p.body,
      line_items: lineItems,
      total_amount: String(total),
      version: 1,
      sent_at: p.sentAt,
      approved_at: p.approvedAt,
      expires_at: p.sentAt ? new Date(new Date(p.sentAt).getTime() + 30 * 864e5).toISOString() : null,
    });
    proposalIds[p.job.id] = prop.id;
    console.log(`     ✓  ${p.status.padEnd(10)} — ${p.title.substring(0, 55)}…  $${total.toLocaleString()}`);
  }

  // ── 8. Work Orders ───────────────────────────────────────────────────────────
  console.log('\n  🔧  Work Orders…');

  // Get a technician if one exists
  const techs = await query('technicians', 'is_active=eq.true&limit=1');
  const techId = techs[0]?.id ?? null;

  const scheduledStart6 = daysFromNow(8); // EL-67835 — scheduled next week
  const scheduledStart7 = new Date(now.setHours(8, 0, 0, 0)).toISOString(); // EL-67836 — today

  const dispatchPacket = (propertyName, address, scope, violations, notes = '') => JSON.stringify({
    propertyName,
    propertyAddress: address,
    buildingType: 'residential',
    elevatorCount: 3,
    contactName: 'Alex Ramirez',
    contactPhone: '(213) 555-0182',
    buildingAccessNotes: 'Elevator machine room key with building engineer. Contact 30 min before arrival.',
    requiredScope: scope,
    violationItems: violations,
    specialInstructions: notes,
    complianceNotes: '48-hour advance notice required. Submit EU-787 after completion.',
    requiredSkillTag: 'traction',
  });

  // WO for Job 6 — scheduled next week
  await insert('work_orders', {
    job_id: j6.job.id,
    assigned_technician_id: techId,
    status: 'assigned',
    scheduled_start: scheduledStart6,
    scheduled_end: new Date(new Date(scheduledStart6).getTime() + 4 * 3600000).toISOString(),
    region: 'Los Angeles – Westside',
    required_skill_tag: 'traction',
    dispatch_notes: '48-hour notice sent to Cal/OSHA and building management. Access confirmed.',
    dispatch_packet: dispatchPacket(
      playa.name, '12501 Bluff Creek Dr, Los Angeles, CA 90094',
      'Annual safety inspection — all safety systems, brakes, and emergency devices.',
      [],
      'Building engineer (Jose, ext. 201) will escort to machine room.'
    ),
    forty_eight_hour_notice_required: true,
    forty_eight_hour_deadline: new Date(new Date(scheduledStart6).getTime() - 48 * 3600000).toISOString(),
    forty_eight_hour_sent_at: daysFromNow(5),
    forty_eight_hour_status: 'sent',
    completion_notes: null,
  });
  console.log(`     ✓  EL-67835 — Scheduled: ${new Date(scheduledStart6).toLocaleDateString()}`);

  // WO for Job 7 — in progress today
  await insert('work_orders', {
    job_id: j7.job.id,
    assigned_technician_id: techId,
    status: 'on_site',
    scheduled_start: scheduledStart7,
    scheduled_end: new Date(new Date(scheduledStart7).getTime() + 9 * 3600000).toISOString(),
    region: 'Los Angeles – Westside',
    required_skill_tag: 'traction',
    dispatch_notes: 'Mechanic on site. Suspension rope replacement in progress. Estimated completion: 5:00 PM.',
    dispatch_packet: dispatchPacket(
      playa.name, '12501 Bluff Creek Dr, Los Angeles, CA 90094',
      'Full suspension wire rope replacement and retensioning. Post-replacement safety test.',
      ['Suspension wire rope at minimum discard diameter', 'Safety factor below 12:1'],
      'Elevator out of service for duration of repair. Building management notified.'
    ),
    forty_eight_hour_notice_required: true,
    forty_eight_hour_deadline: daysAgo(2),
    forty_eight_hour_sent_at: daysAgo(3),
    forty_eight_hour_status: 'sent',
    completion_notes: null,
  });
  console.log(`     ✓  EL-67836 — In Progress: Today (on-site)`);

  // ── 9. Summary ───────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Greystar Demo Seed Complete

  Account:    Greystar Real Estate Partners
  Properties: The Alexan at Beverly Hills
              Greystar Commons at DTLA
              Modera Playa Vista

  Jobs:       7 active (1 critical, 2 high, 3 medium)
  Pipeline:   notice_received → under_review → proposal_drafted
              → proposal_sent → approved → scheduled → in_progress
  Proposals:  5 (1 draft, 1 sent, 3 approved)
  Work Orders: 2 (1 scheduled, 1 on-site today)

  Demo login (client portal):
    Email:    demo@greystar.com
    Password: Greystar-Demo-2026!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

seed().catch(e => { console.error('\n❌  Seed failed:', e.message); process.exit(1); });
