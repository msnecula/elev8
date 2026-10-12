#!/usr/bin/env node
/**
 * scripts/westside-demo-seed.mjs — Westside Properties Demo Seed
 *
 * Populates the database with a realistic compliance pipeline for
 * the Wednesday demo using the existing client@westsideproperties.com account.
 *
 * Demo flow this enables:
 *   1. Admin logs in → sees full dashboard with jobs across all stages
 *   2. Dispatcher logs in → sees action-needed queue
 *   3. client@westsideproperties.com logs in → sees sent proposal → approves it
 *   4. Technician logs in → sees assigned work order
 *   5. Email intake demo → uploads notice → AI parses it
 *
 * Safe to re-run: skips rows that already exist (idempotent).
 *
 * Run:
 *   node --dns-result-order=ipv4first scripts/westside-demo-seed.mjs
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

const H = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

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
    const msg = typeof json === 'object' ? (json?.message ?? json?.error ?? text) : text;
    throw new Error(`[${res.status}] ${path} — ${msg}`);
  }
  return json;
}

const db   = (table) => `/rest/v1/${table}`;
const auth = (path)  => `/auth/v1${path}`;

async function insert(table, rows, extra = {}) {
  const prefer = extra.prefer ?? 'resolution=ignore-duplicates,return=representation';
  const data = await rest('POST', db(table), Array.isArray(rows) ? rows : [rows], {
    Prefer: prefer,
    ...extra,
  });
  return Array.isArray(data) ? data : [data];
}

async function query(table, filters = '') {
  return rest('GET', `${db(table)}?${filters}`);
}

async function findOrCreateAuthUser(email, password, fullName, role) {
  try {
    const data = await rest('POST', auth('/admin/users'), {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return data.id;
  } catch (e) {
    // Already exists — find their ID
    let page = 0;
    while (true) {
      const users = await rest('GET', `${auth('/admin/users')}?page=${page}&per_page=50`);
      const list = users.users ?? users;
      const found = list.find(u => u.email === email);
      if (found) return found.id;
      if (list.length < 50) break;
      page++;
    }
    throw new Error(`Could not find or create user: ${email} — ${e.message}`);
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const now         = new Date();
const daysAgo     = (n) => new Date(now - n * 864e5).toISOString();
const daysFromNow = (n) => new Date(+now + n * 864e5).toISOString();
const dateOnly    = (iso) => iso.split('T')[0];

// ── parsedData factory ────────────────────────────────────────────────────────
function parsedData(overrides) {
  return {
    documentType: 'Cal/OSHA Preliminary Order',
    clientCompany: 'Westside Properties LLC',
    buildingType: 'commercial',
    elevatorType: 'traction',
    serialNumber: '',
    floorsServed: '8',
    unitsAffected: 1,
    safetyTestsRequired: ['Annual Safety Inspection'],
    advanceNotificationRequired: true,
    advanceNotificationHours: 48,
    advanceNotificationRecipients: ['Cal/OSHA District Office', 'Building Owner', 'Property Manager'],
    additionalMaintenanceRequirements: [],
    actionPlan: [],
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
    parseConfidence: 0.94,
    stateDeadline: null,
    ...overrides,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Elev8 Comply — Westside Properties Demo Seed\n');

  // ── 1. Auth users ──────────────────────────────────────────────────────────
  console.log('  👤  Ensuring demo auth users exist…');

  const adminAuthId = await findOrCreateAuthUser(
    'admin@elev8comply.com', 'Admin1234!', 'Admin User', 'admin',
  );
  const clientAuthId = await findOrCreateAuthUser(
    'client@westsideproperties.com', 'Client1234!', 'Alex Johnson', 'client',
  );
  const dispatchAuthId = await findOrCreateAuthUser(
    'dispatcher@elev8comply.com', 'Dispatch1234!', 'Sam Dispatcher', 'dispatcher',
  );
  const techAuthId = await findOrCreateAuthUser(
    'tech1@elev8comply.com', 'Tech1234!', 'Jordan Tech', 'technician',
  );
  console.log('     ✓  admin@elev8comply.com');
  console.log('     ✓  dispatcher@elev8comply.com');
  console.log('     ✓  tech1@elev8comply.com');
  console.log('     ✓  client@westsideproperties.com');

  // ── 2. Account ─────────────────────────────────────────────────────────────
  console.log('\n  📋  Account…');
  let [account] = await query('accounts', 'name=eq.Westside Properties LLC&limit=1');
  if (!account) {
    [account] = await insert('accounts', {
      name:    'Westside Properties LLC',
      email:   'ops@westsideproperties.com',
      phone:   '310-555-0101',
      address: '1200 Wilshire Blvd Suite 800',
      city:    'Los Angeles', state: 'CA', zip: '90025',
      notes:   'Commercial and residential portfolio in West Los Angeles. Primary demo account.',
      is_active: true,
    });
  }
  const accountId = account.id;
  console.log(`     ✓  ${account.name} (${accountId})`);

  // ── 3. Upsert public.users rows ────────────────────────────────────────────
  // The trigger handle_new_auth_user may have already created these,
  // but role/account_id may be missing. Upsert with full fields.
  await rest('POST', db('users'), [
    { id: adminAuthId, email: 'admin@elev8comply.com', full_name: 'Admin User', role: 'admin', is_active: true, account_id: null },
    { id: dispatchAuthId, email: 'dispatcher@elev8comply.com', full_name: 'Sam Dispatcher', role: 'dispatcher', is_active: true, account_id: null },
    { id: techAuthId, email: 'tech1@elev8comply.com', full_name: 'Jordan Tech', role: 'technician', is_active: true, account_id: null },
    { id: clientAuthId, email: 'client@westsideproperties.com', full_name: 'Alex Johnson', role: 'client', is_active: true, account_id: accountId, phone: '310-555-0111' },
  ], { Prefer: 'resolution=merge-duplicates,return=representation' });
  console.log('     ✓  public.users rows upserted');

  // ── 4. Technician record ───────────────────────────────────────────────────
  console.log('\n  🔧  Technician record…');
  let [tech] = await query('technicians', `user_id=eq.${techAuthId}&limit=1`);
  if (!tech) {
    [tech] = await insert('technicians', {
      user_id: techAuthId,
      certification_number: 'CCCM-2024-7741',
      skill_tags: ['traction', 'hydraulic'],
      is_active: true,
      region: 'Los Angeles – Westside',
    });
  }
  const techId = tech.id;
  console.log(`     ✓  Technician: Jordan Tech (cert CCCM-2024-7741)`);

  // ── 5. Properties ─────────────────────────────────────────────────────────
  console.log('\n  🏢  Properties…');
  const propDefs = [
    {
      name: 'Westside Plaza',
      address: '1200 Wilshire Blvd', city: 'Los Angeles', state: 'CA', zip: '90025',
      building_type: 'commercial', elevator_count: 4,
      notes: '8-story commercial office building. 4 traction elevators (2 passenger, 2 freight). Built 2005.',
    },
    {
      name: 'Ocean View Residences',
      address: '8800 Lincoln Blvd', city: 'Marina del Rey', state: 'CA', zip: '90292',
      building_type: 'residential', elevator_count: 2,
      notes: '12-story luxury residential. 2 traction elevators. Built 2018. Concierge building.',
    },
    {
      name: 'West LA Medical Plaza',
      address: '2080 Century Park East', city: 'Los Angeles', state: 'CA', zip: '90067',
      building_type: 'commercial', elevator_count: 6,
      notes: '15-story medical office complex. 6 elevators (4 traction, 2 hydraulic). ADA compliance critical.',
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
  const [westPlaza, oceanView, medPlaza] = props;

  // ── 6. Notices & Jobs ──────────────────────────────────────────────────────
  console.log('\n  📄  Notices & Jobs (full pipeline)…');

  async function createNoticeAndJob({
    property, equipmentId, elevatorType, propertyAddress, propertyName,
    noticeUrgency, jobStage, jobUrgency, title,
    requiredWorkSummary, safetyTestsRequired, violationItems = [],
    complianceDeadlineOffset, inspectionDaysAgo,
    estimatedLabor, estimatedMaterials, workType, requiredSkillTag,
    fortyEightHourRequired = true, complianceCoordinationRequired = false,
  }) {
    const complianceDeadline = dateOnly(daysFromNow(complianceDeadlineOffset));
    const inspectionDate     = dateOnly(daysAgo(inspectionDaysAgo));

    const [notice] = await insert('notices', {
      account_id:    accountId,
      property_id:   property.id,
      submitted_by:  null,
      intake_method: 'upload',
      status:        'parsed',
      file_name:     `Cal-OSHA-PO-${equipmentId}.pdf`,
      file_size:     Math.floor(Math.random() * 200000) + 60000,
      mime_type:     'application/pdf',
      urgency:       noticeUrgency,
      state_deadline: new Date(complianceDeadline + 'T17:00:00Z').toISOString(),
      parsed_data:   parsedData({
        propertyName,
        propertyAddress,
        equipmentId,
        elevatorType,
        requiredWorkSummary,
        safetyTestsRequired,
        violationItems,
        complianceDeadline,
        inspectionDate,
        estimatedLaborHours:  estimatedLabor,
        estimatedMaterials,
        workType,
        requiredSkillTag,
        fortyEightHourRequired,
        complianceCoordinationRequired,
        urgency: noticeUrgency,
      }),
    });

    const nextActionDate = complianceDeadlineOffset < 7
      ? dateOnly(now.toISOString())
      : dateOnly(daysFromNow(Math.min(complianceDeadlineOffset - 5, 14)));

    const [job] = await insert('jobs', {
      notice_id:                     notice.id,
      property_id:                   property.id,
      account_id:                    accountId,
      assigned_reviewer_id:          adminAuthId,
      stage:                         jobStage,
      urgency:                       jobUrgency,
      title,
      next_action_date:              nextActionDate,
      risk_flags:                    fortyEightHourRequired ? ['48hr_notice_required'] : [],
      building_type:                 property.building_type,
      required_skill_tag:            requiredSkillTag,
      estimated_duration_hours:      String(estimatedLabor),
      estimated_labor_hours:         String(estimatedLabor),
      estimated_materials_cost:      String(estimatedMaterials),
      compliance_coordination_required: complianceCoordinationRequired,
      forty_eight_hour_required:     fortyEightHourRequired,
      internal_notes:                `Demo — ${propertyName}, State ID ${equipmentId}`,
    });

    console.log(`     ✓  [${jobStage.toUpperCase().padEnd(18)}] ${title}`);
    return { notice, job };
  }

  // Job 1: notice_received — CRITICAL (overdue, needs immediate attention)
  const j1 = await createNoticeAndJob({
    property: westPlaza, propertyName: westPlaza.name,
    propertyAddress: '1200 Wilshire Blvd, Los Angeles, CA 90025',
    equipmentId: 'EL-44201', elevatorType: 'traction',
    noticeUrgency: 'critical', jobStage: 'notice_received', jobUrgency: 'critical',
    title: 'Westside Plaza — EL-44201 — 5-Year Full Load Test (OVERDUE)',
    requiredWorkSummary: '5-Year full load test required per CCR §3041. Compliance deadline has passed — immediate action required.',
    safetyTestsRequired: ['5-Year Full Load Test', 'Safety Gear Test', 'Buffer Test'],
    violationItems: ['5-year load test overdue by 12 days', 'Certificate of inspection expired'],
    complianceDeadlineOffset: -12,
    inspectionDaysAgo: 40,
    estimatedLabor: 6, estimatedMaterials: 400,
    workType: 'periodic_test', requiredSkillTag: 'traction',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // Job 2: under_review — HIGH (dispatcher reviewing action plan)
  const j2 = await createNoticeAndJob({
    property: westPlaza, propertyName: westPlaza.name,
    propertyAddress: '1200 Wilshire Blvd, Los Angeles, CA 90025',
    equipmentId: 'EL-44202', elevatorType: 'traction',
    noticeUrgency: 'high', jobStage: 'under_review', jobUrgency: 'high',
    title: 'Westside Plaza — EL-44202 — Annual Safety Inspection',
    requiredWorkSummary: 'Annual safety inspection per CCR Title 8. Brake test, governor test, and emergency device verification.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Brake Test', 'Governor Test'],
    violationItems: ['Annual inspection overdue by 18 days'],
    complianceDeadlineOffset: 12,
    inspectionDaysAgo: 18,
    estimatedLabor: 4, estimatedMaterials: 0,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // Job 3: proposal_drafted — MEDIUM (draft proposal ready for review)
  const j3 = await createNoticeAndJob({
    property: oceanView, propertyName: oceanView.name,
    propertyAddress: '8800 Lincoln Blvd, Marina del Rey, CA 90292',
    equipmentId: 'EL-77341', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'proposal_drafted', jobUrgency: 'medium',
    title: 'Ocean View Residences — EL-77341 — Annual Inspection & Door Adjustment',
    requiredWorkSummary: 'Annual inspection with door operator adjustment. Slight door reopening device drift noted in preliminary order.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Door Operator Test'],
    violationItems: ['Door reopening device adjustment required', 'Minor leveling inaccuracy'],
    complianceDeadlineOffset: 21,
    inspectionDaysAgo: 14,
    estimatedLabor: 3, estimatedMaterials: 85,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // Job 4: proposal_sent — MEDIUM (⭐ client approves this in demo!)
  const j4 = await createNoticeAndJob({
    property: oceanView, propertyName: oceanView.name,
    propertyAddress: '8800 Lincoln Blvd, Marina del Rey, CA 90292',
    equipmentId: 'EL-77342', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'proposal_sent', jobUrgency: 'medium',
    title: 'Ocean View Residences — EL-77342 — Post-Alteration Inspection',
    requiredWorkSummary: 'Post-alteration inspection following lobby renovation impact on elevator. Certification required before return to full service.',
    safetyTestsRequired: ['Post-Alteration Inspection', 'Full Safety Certification'],
    violationItems: ['Post-alteration inspection required per CCR §3001.3'],
    complianceDeadlineOffset: 30,
    inspectionDaysAgo: 10,
    estimatedLabor: 4, estimatedMaterials: 0,
    workType: 'reinspection', requiredSkillTag: 'traction',
    fortyEightHourRequired: true,
  });

  // Job 5: approved — HIGH (proposal approved, awaiting scheduling)
  const j5 = await createNoticeAndJob({
    property: medPlaza, propertyName: medPlaza.name,
    propertyAddress: '2080 Century Park East, Los Angeles, CA 90067',
    equipmentId: 'EL-90112', elevatorType: 'hydraulic',
    noticeUrgency: 'high', jobStage: 'approved', jobUrgency: 'high',
    title: 'West LA Medical Plaza — EL-90112 — 5-Year Hydraulic Test',
    requiredWorkSummary: '5-Year hydraulic pressure test and full inspection. Medical building — coordinate with building management for minimal disruption.',
    safetyTestsRequired: ['5-Year Hydraulic Pressure Test', 'Piston Rod Inspection', 'Full Load Test'],
    violationItems: ['5-year hydraulic test due within 14 days'],
    complianceDeadlineOffset: 14,
    inspectionDaysAgo: 7,
    estimatedLabor: 7, estimatedMaterials: 950,
    workType: 'periodic_test', requiredSkillTag: 'hydraulic',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // Job 6: scheduled — MEDIUM (has work order, scheduled next week)
  const j6 = await createNoticeAndJob({
    property: medPlaza, propertyName: medPlaza.name,
    propertyAddress: '2080 Century Park East, Los Angeles, CA 90067',
    equipmentId: 'EL-90113', elevatorType: 'traction',
    noticeUrgency: 'medium', jobStage: 'scheduled', jobUrgency: 'medium',
    title: 'West LA Medical Plaza — EL-90113 — Annual Safety Inspection',
    requiredWorkSummary: 'Annual safety inspection. All safety devices, brake test, and emergency operation verification.',
    safetyTestsRequired: ['Annual Safety Inspection', 'Brake Test'],
    violationItems: [],
    complianceDeadlineOffset: 42,
    inspectionDaysAgo: 5,
    estimatedLabor: 4, estimatedMaterials: 0,
    workType: 'annual_test', requiredSkillTag: 'traction',
  });

  // Job 7: in_progress — HIGH (technician on site today)
  const j7 = await createNoticeAndJob({
    property: westPlaza, propertyName: westPlaza.name,
    propertyAddress: '1200 Wilshire Blvd, Los Angeles, CA 90025',
    equipmentId: 'EL-44205', elevatorType: 'traction',
    noticeUrgency: 'high', jobStage: 'in_progress', jobUrgency: 'high',
    title: 'Westside Plaza — EL-44205 — Suspension Rope Replacement',
    requiredWorkSummary: 'Wire rope replacement and retensioning. Cal/OSHA EU-787 notification required post-completion.',
    safetyTestsRequired: ['Suspension Means Safety Test', 'Post-Replacement Inspection'],
    violationItems: ['Wire rope at minimum discard diameter', 'Safety factor below 12:1'],
    complianceDeadlineOffset: 6,
    inspectionDaysAgo: 9,
    estimatedLabor: 8, estimatedMaterials: 2800,
    workType: 'repair', requiredSkillTag: 'traction',
    fortyEightHourRequired: true, complianceCoordinationRequired: true,
  });

  // ── 7. Proposals ────────────────────────────────────────────────────────────
  console.log('\n  📝  Proposals…');

  function buildLineItems(laborHours, materialsCost, workTitle) {
    const items = [
      {
        id: randomUUID(),
        description: `${workTitle} — Certified Elevator Mechanic Labor`,
        quantity: laborHours, unit: 'hr', unitPrice: 175,
        total: laborHours * 175,
      },
      {
        id: randomUUID(),
        description: 'Cal/OSHA Permit & Documentation Fee',
        quantity: 1, unit: 'ea', unitPrice: 150, total: 150,
      },
    ];
    if (materialsCost > 0) {
      items.push({
        id: randomUUID(),
        description: 'Materials & Parts',
        quantity: 1, unit: 'lot', unitPrice: materialsCost, total: materialsCost,
      });
    }
    items.push({
      id: randomUUID(),
      description: '48-Hour Advance Notice & Compliance Coordination',
      quantity: 1, unit: 'ea', unitPrice: 95, total: 95,
    });
    return items;
  }

  const proposalDefs = [
    // Job 3 — draft
    {
      job: j3.job, status: 'draft', sentAt: null, approvedAt: null,
      title: 'Proposal — Annual Inspection & Door Adjustment — EL-77341',
      body: `Dear Westside Properties LLC,\n\nThank you for entrusting Precision Lift Co. with your elevator compliance needs. Please find our proposal for the annual safety inspection and door operator adjustment for elevator EL-77341 at Ocean View Residences.\n\nOur CCCM-certified mechanics will perform all required tests per CCR Title 8 regulations and file all required documentation with the Cal/OSHA district office.\n\nThis proposal is valid for 30 days.`,
      laborHours: 3, materialsCost: 85, workTitle: 'Annual Safety Inspection & Door Adjustment',
    },

    // Job 4 — SENT (⭐ client approves this during demo)
    {
      job: j4.job, status: 'sent', sentAt: daysAgo(3), approvedAt: null,
      title: 'Proposal — Post-Alteration Inspection — EL-77342',
      body: `Dear Westside Properties LLC,\n\nFollowing the recent lobby renovation at Ocean View Residences, Cal/OSHA requires a post-alteration inspection of elevator EL-77342 before it returns to full service.\n\nPrecision Lift Co. will perform a complete safety inspection and certification per CCR §3001.3. We will coordinate directly with Cal/OSHA's Los Angeles district office.\n\n⚠ Important: This elevator should remain at limited capacity until the inspection is complete.\n\nWe look forward to your approval to schedule this work promptly.`,
      laborHours: 4, materialsCost: 0, workTitle: 'Post-Alteration Inspection & Certification',
    },

    // Job 5 — approved
    {
      job: j5.job, status: 'approved', sentAt: daysAgo(14), approvedAt: daysAgo(11),
      title: 'Proposal — 5-Year Hydraulic Test — EL-90112',
      body: `Dear Westside Properties LLC,\n\nThis proposal covers the mandatory 5-year hydraulic pressure test and full inspection for elevator EL-90112 at West LA Medical Plaza.\n\nGiven the medical building setting, we will coordinate with your building management team to schedule during off-peak hours to minimize disruption to building tenants.\n\nAll required Cal/OSHA documentation will be submitted upon test completion.`,
      laborHours: 7, materialsCost: 950, workTitle: '5-Year Hydraulic Pressure Test',
    },

    // Job 6 — approved (scheduled)
    {
      job: j6.job, status: 'approved', sentAt: daysAgo(22), approvedAt: daysAgo(19),
      title: 'Proposal — Annual Safety Inspection — EL-90113',
      body: `Dear Westside Properties LLC,\n\nThis proposal covers the annual safety inspection for elevator EL-90113 at West LA Medical Plaza.\n\nAll safety devices, brakes, and emergency operations will be inspected and tested by our certified mechanics per CCR Title 8.`,
      laborHours: 4, materialsCost: 0, workTitle: 'Annual Safety Inspection',
    },

    // Job 7 — approved (in progress)
    {
      job: j7.job, status: 'approved', sentAt: daysAgo(20), approvedAt: daysAgo(17),
      title: 'Proposal — Suspension Wire Rope Replacement — EL-44205',
      body: `Dear Westside Properties LLC,\n\nThis proposal covers the full suspension wire rope replacement and retensioning for elevator EL-44205 at Westside Plaza.\n\nThis is a safety-critical repair. Our team will replace all suspension means, perform complete post-replacement safety testing, and file the Cal/OSHA suspension means notification (EU-787) upon completion.\n\n⚠ The elevator will be out of service during the repair — estimated 1 full business day.`,
      laborHours: 8, materialsCost: 2800, workTitle: 'Suspension Wire Rope Replacement',
    },
  ];

  for (const p of proposalDefs) {
    const lineItems = buildLineItems(p.laborHours, p.materialsCost, p.workTitle);
    const total = lineItems.reduce((s, i) => s + i.total, 0);
    await insert('proposals', {
      job_id:      p.job.id,
      drafted_by:  adminAuthId,
      approved_by: p.approvedAt ? clientAuthId : null,
      status:      p.status,
      title:       p.title,
      body:        p.body,
      line_items:  lineItems,
      total_amount: String(total),
      version:     1,
      sent_at:     p.sentAt,
      approved_at: p.approvedAt,
      expires_at:  p.sentAt
        ? new Date(new Date(p.sentAt).getTime() + 30 * 864e5).toISOString()
        : null,
    });
    console.log(`     ✓  ${p.status.padEnd(10)} — $${total.toLocaleString()}  ${p.title.substring(0, 50)}…`);
  }

  // ── 8. Scheduling Requests ────────────────────────────────────────────────
  console.log('\n  📅  Scheduling requests…');

  // Confirmed schedule for Job 6 (scheduled)
  const j6ConfirmedStart = daysFromNow(9);
  const [sched6] = await insert('scheduling_requests', {
    job_id:               j6.job.id,
    requested_by:         clientAuthId,
    status:               'confirmed',
    preferred_dates:      [dateOnly(daysFromNow(9)), dateOnly(daysFromNow(10))],
    preferred_time_range: 'morning',
    access_notes:         'Building engineer (Maria, ext. 305) will escort to machine room. Park in Lot B.',
    confirmed_start_date: j6ConfirmedStart,
    confirmed_end_date:   new Date(new Date(j6ConfirmedStart).getTime() + 4 * 3600000).toISOString(),
    confirmed_by:         dispatchAuthId,
    confirmed_at:         daysAgo(5),
  });
  console.log(`     ✓  EL-90113 — confirmed for ${new Date(j6ConfirmedStart).toLocaleDateString()}`);

  // Pending schedule request for Job 5 (approved — needs scheduling)
  await insert('scheduling_requests', {
    job_id:               j5.job.id,
    requested_by:         clientAuthId,
    status:               'pending',
    preferred_dates:      [dateOnly(daysFromNow(5)), dateOnly(daysFromNow(6)), dateOnly(daysFromNow(7))],
    preferred_time_range: 'morning',
    access_notes:         'Medical office — schedule before 8am or after 6pm. Contact Dr. Kim at ext. 101.',
    confirmed_start_date: null,
    confirmed_end_date:   null,
  });
  console.log(`     ✓  EL-90112 — pending (awaiting dispatcher confirmation)`);

  // ── 9. Work Orders ─────────────────────────────────────────────────────────
  console.log('\n  🔧  Work Orders…');

  const dispatchPacket = (propName, address, scope, violations, notes = '') => JSON.stringify({
    propertyName: propName,
    propertyAddress: address,
    buildingType: 'commercial',
    elevatorCount: 4,
    contactName: 'Alex Johnson',
    contactPhone: '310-555-0111',
    buildingAccessNotes: 'Security desk in lobby — show CCCM badge. Machine room on roof level.',
    requiredScope: scope,
    violationItems: violations,
    specialInstructions: notes,
    complianceNotes: '48-hour advance notice required. Submit EU-787 after completion.',
    requiredSkillTag: 'traction',
  });

  // WO for Job 6 — scheduled next week
  const scheduledStart6 = j6ConfirmedStart;
  await insert('work_orders', {
    job_id:                    j6.job.id,
    assigned_technician_id:    techId,
    status:                    'assigned',
    scheduled_start:           scheduledStart6,
    scheduled_end:             new Date(new Date(scheduledStart6).getTime() + 4 * 3600000).toISOString(),
    region:                    'Los Angeles – Westside',
    required_skill_tag:        'traction',
    dispatch_notes:            '48-hour notice filed. Building access confirmed with Maria (ext. 305). Park in Lot B.',
    dispatch_packet:           dispatchPacket(
      medPlaza.name, '2080 Century Park East, Los Angeles, CA 90067',
      'Annual safety inspection — brakes, governor, emergency devices, landing accuracy.',
      [],
      'Low-traffic medical corridor. Building engineer escort required.'
    ),
    forty_eight_hour_notice_required: true,
    forty_eight_hour_deadline: new Date(new Date(scheduledStart6).getTime() - 48 * 3600000).toISOString(),
    forty_eight_hour_sent_at:  daysFromNow(7),
    forty_eight_hour_status:   'sent',
    completion_notes:          null,
  });
  console.log(`     ✓  EL-90113 — Assigned to Jordan Tech, scheduled ${new Date(scheduledStart6).toLocaleDateString()}`);

  // WO for Job 7 — in progress today
  const todayStart = new Date(now);
  todayStart.setHours(7, 30, 0, 0);
  await insert('work_orders', {
    job_id:                    j7.job.id,
    assigned_technician_id:    techId,
    status:                    'on_site',
    scheduled_start:           todayStart.toISOString(),
    scheduled_end:             new Date(todayStart.getTime() + 9 * 3600000).toISOString(),
    region:                    'Los Angeles – Westside',
    required_skill_tag:        'traction',
    dispatch_notes:            'Jordan on-site since 7:30am. Wire rope replacement ~60% complete. ETA completion 4:30pm.',
    dispatch_packet:           dispatchPacket(
      westPlaza.name, '1200 Wilshire Blvd, Los Angeles, CA 90025',
      'Full wire rope replacement and retensioning. Post-repair safety test and EU-787 filing.',
      ['Wire rope at minimum discard diameter', 'Safety factor below 12:1'],
      'Elevator out of service — lobby team notified. Freight elevator available on south side.'
    ),
    forty_eight_hour_notice_required: true,
    forty_eight_hour_deadline: daysAgo(2),
    forty_eight_hour_sent_at:  daysAgo(3),
    forty_eight_hour_status:   'sent',
    completion_notes:          null,
  });
  console.log(`     ✓  EL-44205 — On-site today (in progress)`);

  // ── 10. Summary ────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Westside Properties Demo Seed Complete

  Account:  Westside Properties LLC
  Properties:
    • Westside Plaza (commercial, 4 elevators)
    • Ocean View Residences (residential, 2 elevators)
    • West LA Medical Plaza (commercial, 6 elevators)

  Jobs (7 total — full pipeline):
    NOTICE_RECEIVED  EL-44201  ⚠ OVERDUE — 5-Year Load Test
    UNDER_REVIEW     EL-44202  Annual Inspection (18 days late)
    PROPOSAL_DRAFTED EL-77341  Annual + Door Adjustment
    PROPOSAL_SENT    EL-77342  ⭐ Client approves this in demo!
    APPROVED         EL-90112  5-Year Hydraulic Test
    SCHEDULED        EL-90113  Annual Inspection — next week
    IN_PROGRESS      EL-44205  Wire Rope Replacement — today

  Demo logins:
    Admin/Staff:  admin@elev8comply.com       / Admin1234!
    Dispatcher:   dispatcher@elev8comply.com  / Dispatch1234!
    Technician:   tech1@elev8comply.com       / Tech1234!
    Client:       client@westsideproperties.com / Client1234!

  Demo flow for Wednesday:
    1. Log in as admin → show full dashboard & pipeline
    2. Log in as dispatcher → show action queue, dispatch a WO
    3. Log in as client → approve the proposal for EL-77342
    4. Back as admin → show job moves to 'approved' stage
    5. Upload a new notice PDF → show AI parse → new job created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

seed().catch(e => {
  console.error('\n❌  Seed failed:', e.message);
  process.exit(1);
});
