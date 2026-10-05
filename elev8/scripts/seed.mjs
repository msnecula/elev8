#!/usr/bin/env node
/**
 * scripts/seed.mjs — Zero-dependency Elev8 Comply seed
 * Uses only Node.js built-ins: fs, fetch (native since Node 18)
 * No supabase-js, no dotenv, no esbuild, no tsx.
 *
 * Run: node --dns-result-order=ipv4first scripts/seed.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load .env.local without dotenv ───────────────────────────────────────────
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
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* file absent — rely on actual env vars */ }
}
loadEnv(resolve(ROOT, '.env.local'));
loadEnv(resolve(ROOT, '.env'));

// ── Validate env ─────────────────────────────────────────────────────────────
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL) {
  console.error('\n❌  NEXT_PUBLIC_SUPABASE_URL is not set.');
  console.error('    .env.local should be at:', resolve(ROOT, '.env.local'));
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY is not set.');
  console.error('    .env.local should be at:', resolve(ROOT, '.env.local'));
  process.exit(1);
}
console.log('  URL:', SUPABASE_URL);
console.log('  Key:', SERVICE_KEY.slice(0, 20) + '…');

// ── HTTP helpers ─────────────────────────────────────────────────────────────
const BASE_HEADERS = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
};

async function rest(method, path, body, extra = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...BASE_HEADERS, ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const code = typeof json === 'object' ? (json?.code ?? '') : '';
    const msg  = typeof json === 'object' ? (json?.message ?? text) : text;
    throw Object.assign(new Error(`[${res.status}] ${path} — ${msg}`), { code, status: res.status });
  }
  return json;
}

// PostgREST: insert rows, return inserted rows
async function dbInsert(table, rows) {
  const arr = Array.isArray(rows) ? rows : [rows];
  try {
    return await rest('POST', `/rest/v1/${table}`, arr, { Prefer: 'return=representation' });
  } catch (err) {
    if (err.code === '23505' || String(err.message).includes('duplicate') || String(err.message).includes('already exists')) {
      console.log(`  ⚠  ${table}: duplicate — skipping`);
      return null;
    }
    throw err;
  }
}

// PostgREST: upsert rows
async function dbUpsert(table, rows, onConflict = 'id') {
  const arr = Array.isArray(rows) ? rows : [rows];
  return rest('POST', `/rest/v1/${table}`, arr, {
    Prefer: `resolution=merge-duplicates,return=representation`,
  });
}

// PostgREST: select
async function dbSelect(table, query = '') {
  return rest('GET', `/rest/v1/${table}${query ? '?' + query : ''}`);
}

// Auth admin: create a user
async function authCreate(email, password, meta) {
  try {
    const data = await rest('POST', '/auth/v1/admin/users', {
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    return data;
  } catch (err) {
    if (String(err.message).toLowerCase().includes('already') ||
        String(err.message).toLowerCase().includes('registered') ||
        err.status === 422) {
      // User already exists — fetch them
      const list = await rest('GET', '/auth/v1/admin/users?page=1&per_page=500');
      const users = list?.users ?? list;
      return users.find(u => u.email === email);
    }
    throw err;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Seeding Elev8 Comply…  (zero npm deps)\n');

  // Guard: bail if already seeded
  const existing = await dbSelect('accounts', 'select=id&limit=1');
  if (Array.isArray(existing) && existing.length > 0) {
    console.log('⚠  Database already seeded — accounts exist.');
    console.log('   To re-seed: delete all rows in the accounts table first.\n');
    process.exit(0);
  }

  // ── Accounts ────────────────────────────────────────────────────────────────
  console.log('  [1/9] Accounts…');
  const accounts = await dbInsert('accounts', [
    { name: 'Westside Properties LLC', email: 'ops@westsideproperties.com',  phone: '310-555-0101', address: '9999 Wilshire Blvd Ste 400', city: 'Los Angeles', state: 'CA', zip: '90025' },
    { name: 'Harbor View Realty',      email: 'compliance@harborview.com',   phone: '562-555-0202', city: 'Long Beach',   state: 'CA', zip: '90802' },
    { name: 'Summit Tower Group',      email: 'management@summittower.com',  phone: '213-555-0303', city: 'Los Angeles',  state: 'CA' },
  ]);
  if (!accounts) throw new Error('Accounts insert failed — check your Supabase RLS policies (service role should bypass them).');
  const [acct1, acct2, acct3] = accounts;

  // ── Auth users ──────────────────────────────────────────────────────────────
  console.log('  [2/9] Auth users…');
  const adminAuth      = await authCreate('admin@elev8comply.com',         'Admin1234!',    { full_name: 'Sarah Chen',    role: 'admin' });
  const reviewerAuth   = await authCreate('reviewer@elev8comply.com',      'Review1234!',   { full_name: 'Marcus Rivera', role: 'reviewer' });
  const dispatcherAuth = await authCreate('dispatcher@elev8comply.com',    'Dispatch1234!', { full_name: 'Jamie Torres',  role: 'dispatcher' });
  const tech1Auth      = await authCreate('tech1@elev8comply.com',         'Tech1234!',     { full_name: 'David Kim',     role: 'technician' });
  const tech2Auth      = await authCreate('tech2@elev8comply.com',         'Tech1234!',     { full_name: 'Rosa Martinez', role: 'technician' });
  const client1Auth    = await authCreate('client@westsideproperties.com', 'Client1234!',   { full_name: 'Alex Johnson',  role: 'client' });
  const client2Auth    = await authCreate('client@harborview.com',         'Client1234!',   { full_name: 'Brianna Lee',   role: 'client' });

  for (const u of [adminAuth, reviewerAuth, dispatcherAuth, tech1Auth, tech2Auth, client1Auth, client2Auth]) {
    if (!u?.id) throw new Error(`Auth user missing id — got: ${JSON.stringify(u)}`);
  }

  // ── Public users ─────────────────────────────────────────────────────────────
  console.log('  [3/9] Public users…');
  await dbUpsert('users', [
    { id: adminAuth.id,      email: 'admin@elev8comply.com',         full_name: 'Sarah Chen',    role: 'admin' },
    { id: reviewerAuth.id,   email: 'reviewer@elev8comply.com',      full_name: 'Marcus Rivera', role: 'reviewer' },
    { id: dispatcherAuth.id, email: 'dispatcher@elev8comply.com',    full_name: 'Jamie Torres',  role: 'dispatcher' },
    { id: tech1Auth.id,      email: 'tech1@elev8comply.com',         full_name: 'David Kim',     role: 'technician' },
    { id: tech2Auth.id,      email: 'tech2@elev8comply.com',         full_name: 'Rosa Martinez', role: 'technician' },
    { id: client1Auth.id,    email: 'client@westsideproperties.com', full_name: 'Alex Johnson',  role: 'client', account_id: acct1.id },
    { id: client2Auth.id,    email: 'client@harborview.com',         full_name: 'Brianna Lee',   role: 'client', account_id: acct2.id },
  ]);

  // ── Technicians ──────────────────────────────────────────────────────────────
  console.log('  [4/9] Technicians…');
  const techs = await dbInsert('technicians', [
    { user_id: tech1Auth.id, employee_id: 'EMP-001', full_name: 'David Kim',     email: 'tech1@elev8comply.com', phone: '213-555-1001', skill_tags: ['hydraulic','traction','mrl','commercial'],              regions: ['Los Angeles','Orange County'] },
    { user_id: tech2Auth.id, employee_id: 'EMP-002', full_name: 'Rosa Martinez', email: 'tech2@elev8comply.com', phone: '213-555-1002', skill_tags: ['escalator','traction','residential','commercial'], regions: ['Los Angeles','San Bernardino','Riverside'] },
  ]);
  const [tech1, tech2] = techs ?? [null, null];

  // ── Contacts ─────────────────────────────────────────────────────────────────
  console.log('  [5/9] Contacts & Properties…');
  await dbInsert('contacts', [
    { account_id: acct1.id, full_name: 'Alex Johnson',  email: 'client@westsideproperties.com', phone: '310-555-0111', title: 'Property Manager',    is_primary: true  },
    { account_id: acct1.id, full_name: 'Dana Lee',      email: 'dana@westsideproperties.com',   phone: '310-555-0112', title: 'Facilities Director', is_primary: false },
    { account_id: acct2.id, full_name: 'Brianna Lee',   email: 'client@harborview.com',         phone: '562-555-0211', title: 'Compliance Officer',  is_primary: true  },
    { account_id: acct3.id, full_name: 'Carlos Mendez', email: 'carlos@summittower.com',        phone: '213-555-0311', title: 'Building Manager',    is_primary: true  },
  ]);

  // ── Properties ───────────────────────────────────────────────────────────────
  const props = await dbInsert('properties', [
    { account_id: acct1.id, name: 'Westside Plaza',        address: '1200 Wilshire Blvd', city: 'Los Angeles',    state: 'CA', zip: '90025', building_type: 'commercial',  elevator_count: 4 },
    { account_id: acct1.id, name: 'Ocean View Residences', address: '8800 Lincoln Blvd',  city: 'Marina del Rey', state: 'CA', zip: '90292', building_type: 'residential', elevator_count: 2 },
    { account_id: acct2.id, name: 'Harbor Tower',          address: '400 Ocean Blvd',     city: 'Long Beach',     state: 'CA', zip: '90802', building_type: 'commercial',  elevator_count: 6 },
    { account_id: acct3.id, name: 'Summit Center',         address: '333 S Grand Ave',    city: 'Los Angeles',    state: 'CA', zip: '90071', building_type: 'commercial',  elevator_count: 8 },
  ]);
  if (!props) throw new Error('Properties insert failed.');
  const [prop1, prop2, prop3, prop4] = props;

  // ── Proposal templates ───────────────────────────────────────────────────────
  console.log('  [6/9] Proposal templates…');
  await dbInsert('proposal_templates', [
    {
      name: 'Standard Commercial Elevator Service',
      work_type: 'annual_inspection',
      body_template: 'Dear {{clientName}},\n\nThank you for submitting the Order to Comply notice for {{propertyName}}.\n\nWe have reviewed the violations and are pleased to provide this proposal to bring your elevator(s) into full compliance with California state regulations.\n\nSCOPE OF WORK:\n{{scope}}\n\nAll work will be performed by our CAL/OSHA certified elevator mechanics.\n\nSincerely,\nElev8 Comply',
      default_line_items: [
        { id: 'li-1', description: 'Elevator safety inspection and annual certification', quantity: 1, unit: 'each',     unitPrice: 450, total: 450 },
        { id: 'li-2', description: 'Labor — CAL/OSHA certified elevator mechanic',       quantity: 6, unit: 'hrs',      unitPrice: 155, total: 930 },
        { id: 'li-3', description: 'Materials and replacement parts',                    quantity: 1, unit: 'lump sum', unitPrice: 850, total: 850 },
        { id: 'li-4', description: 'Compliance documentation package',                   quantity: 1, unit: 'each',     unitPrice: 125, total: 125 },
      ],
    },
    {
      name: 'Emergency / Critical Compliance',
      work_type: 'emergency_repair',
      body_template: 'Dear {{clientName}},\n\nGiven the critical nature of the Order to Comply notice received for {{propertyName}}, we have prioritized your job for immediate attention.\n\nEMERGENCY SCOPE:\n{{scope}}\n\nOur team is available to mobilize within 48 hours of proposal approval.\n\nUrgently,\nElev8 Comply',
      default_line_items: [
        { id: 'li-1', description: 'Emergency response and priority scheduling', quantity: 1, unit: 'each',     unitPrice:  350, total:  350 },
        { id: 'li-2', description: 'Emergency repair labor (priority rate)',      quantity: 8, unit: 'hrs',      unitPrice:  185, total: 1480 },
        { id: 'li-3', description: 'Emergency parts procurement and materials',  quantity: 1, unit: 'lump sum', unitPrice: 1200, total: 1200 },
        { id: 'li-4', description: 'Compliance filing and documentation',         quantity: 1, unit: 'each',     unitPrice:  200, total:  200 },
      ],
    },
  ]);

  // ── Notices ──────────────────────────────────────────────────────────────────
  console.log('  [7/9] Notices…');
  const notices = await dbInsert('notices', [
    {
      account_id: acct1.id,
      property_id: prop1.id,
      submitted_by: client1Auth.id,
      intake_method: 'portal_upload',
      status: 'parsed',
      file_name: 'OTC_WestsidePlaza_Elev2_2025.pdf',
      file_size: 245000,
      mime_type: 'application/pdf',
      urgency: 'high',
      state_deadline: '2025-08-15',
      assigned_reviewer_id: reviewerAuth.id,
      raw_text: 'ORDER TO COMPLY — Westside Plaza, 1200 Wilshire Blvd, Los Angeles CA 90025. Elevator #2 (Serial: WP-ELV-002, Type: Hydraulic). Violations: Annual inspection overdue 4 months. Door gibs worn beyond tolerance. Guide rail lubrication required. Safety test overdue. Compliance deadline: August 15, 2025.',
      parsed_data: {
        documentType: 'CAL/OSHA Order to Comply',
        clientCompany: 'Westside Properties LLC',
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        buildingType: 'commercial',
        inspectionDate: '2025-05-10',
        stateDeadline: '2025-08-15',
        requiredWorkSummary: 'Replace worn door gibs, lubricate guide rails, test safety brakes on Elevator #2',
        violationItems: ['Annual inspection certificate expired (4 months overdue)', 'Door gibs worn beyond allowable tolerance', 'Guide rail lubrication required', 'Safety brake test overdue'],
        workType: 'Annual inspection and maintenance',
        requiredSkillTag: 'hydraulic',
        estimatedDurationHours: 8,
        estimatedLaborHours: 6,
        estimatedMaterials: 850,
        urgency: 'high',
        fortyEightHourRequired: true,
        complianceCoordinationRequired: true,
        missingInformation: [],
        parseConfidence: 0.94,
      },
    },
    {
      account_id: acct2.id,
      property_id: prop3.id,
      intake_method: 'email_intake',
      status: 'review_pending',
      file_name: 'CAL_OSHA_HarborTower_Critical_2025.pdf',
      file_size: 312000,
      mime_type: 'application/pdf',
      urgency: 'critical',
      state_deadline: '2025-07-01',
      assigned_reviewer_id: adminAuth.id,
    },
    {
      account_id: acct1.id,
      property_id: prop2.id,
      submitted_by: client1Auth.id,
      intake_method: 'portal_upload',
      status: 'received',
      file_name: 'OTC_OceanView_June2025.pdf',
      file_size: 198000,
      mime_type: 'application/pdf',
      urgency: 'medium',
    },
    {
      account_id: acct3.id,
      property_id: prop4.id,
      intake_method: 'email_intake',
      status: 'parsed',
      file_name: 'SummitCenter_Escalator_OTC.pdf',
      file_size: 178000,
      mime_type: 'application/pdf',
      urgency: 'high',
      state_deadline: '2025-09-01',
      assigned_reviewer_id: reviewerAuth.id,
      parsed_data: {
        documentType: 'Order to Comply',
        clientCompany: 'Summit Tower Group',
        propertyName: 'Summit Center',
        propertyAddress: '333 S Grand Ave, Los Angeles CA 90071',
        buildingType: 'commercial',
        inspectionDate: '2025-04-20',
        stateDeadline: '2025-09-01',
        requiredWorkSummary: 'Escalator handrail speed fault and emergency stop test required',
        violationItems: ['Handrail speed deviation exceeds 2% tolerance', 'Emergency stop test required annually'],
        workType: 'Escalator maintenance',
        requiredSkillTag: 'escalator',
        estimatedDurationHours: 6,
        estimatedLaborHours: 5,
        estimatedMaterials: 600,
        urgency: 'high',
        fortyEightHourRequired: false,
        complianceCoordinationRequired: false,
        missingInformation: ['Unit serial number not visible in document'],
        parseConfidence: 0.87,
      },
    },
  ]);
  if (!notices) throw new Error('Notices insert failed.');
  const [notice1, notice2, notice3, notice4] = notices;

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  console.log('  [8/9] Jobs, proposals, scheduling, work orders…');
  const jobs = await dbInsert('jobs', [
    {
      notice_id: notice1.id, account_id: acct1.id, property_id: prop1.id,
      assigned_reviewer_id: reviewerAuth.id,
      stage: 'proposal_sent', urgency: 'high',
      title: 'Annual Inspection & Door Gib Replacement — Westside Plaza Elevator #2',
      next_action_date: '2025-07-10',
      building_type: 'commercial', required_skill_tag: 'hydraulic',
      estimated_duration_hours: '8', estimated_labor_hours: '6', estimated_materials_cost: '850',
      forty_eight_hour_required: true, compliance_coordination_required: true,
      risk_flags: [],
    },
    {
      notice_id: notice2.id, account_id: acct2.id, property_id: prop3.id,
      assigned_reviewer_id: adminAuth.id,
      stage: 'under_review', urgency: 'critical',
      title: 'Critical CAL/OSHA Compliance — Harbor Tower (All Elevators)',
      next_action_date: '2025-06-25',
      building_type: 'commercial', required_skill_tag: 'traction',
      forty_eight_hour_required: true, compliance_coordination_required: true,
      risk_flags: ['critical_urgency', 'deadline_imminent'],
    },
    {
      notice_id: notice3.id, account_id: acct1.id, property_id: prop2.id,
      assigned_reviewer_id: reviewerAuth.id,
      stage: 'notice_received', urgency: 'medium',
      title: 'Elevator Compliance Review — Ocean View Residences',
      building_type: 'residential', required_skill_tag: 'hydraulic',
      risk_flags: [],
    },
    {
      notice_id: notice4.id, account_id: acct3.id, property_id: prop4.id,
      assigned_reviewer_id: reviewerAuth.id,
      stage: 'approved', urgency: 'high',
      title: 'Escalator Maintenance & Safety Test — Summit Center',
      next_action_date: '2025-07-20',
      building_type: 'commercial', required_skill_tag: 'escalator',
      estimated_duration_hours: '6', estimated_labor_hours: '5', estimated_materials_cost: '600',
      forty_eight_hour_required: false, compliance_coordination_required: false,
      risk_flags: ['missing_info'],
    },
    {
      account_id: acct1.id, property_id: prop1.id,
      assigned_reviewer_id: reviewerAuth.id,
      stage: 'completed', urgency: 'medium',
      title: 'Annual Inspection — Westside Plaza Elevator #1',
      building_type: 'commercial', required_skill_tag: 'hydraulic',
      risk_flags: [],
    },
  ]);
  if (!jobs) throw new Error('Jobs insert failed.');
  const [job1, job2, job3, job4, job5] = jobs;

  // Proposal
  await dbInsert('proposals', [{
    job_id: job1.id,
    drafted_by: reviewerAuth.id,
    status: 'sent',
    title: 'Proposal — Annual Inspection & Door Gib Replacement — Westside Plaza Elevator #2',
    body: 'Dear Alex Johnson,\n\nThank you for submitting the Order to Comply notice for Westside Plaza. We are pleased to provide this proposal to bring your elevator into full compliance.\n\nSCOPE OF WORK:\n• Replace worn door gibs on Elevator #2 (both landing and car door sides)\n• Lubricate and adjust guide rails per manufacturer specification\n• Conduct full safety brake test and certification per ASME A17.1\n• Complete annual inspection and issue California compliance certificate\n\nAll work performed by CAL/OSHA certified elevator mechanics. 48-hour advance notice coordinated with your compliance company.\n\nEstimated duration: 8 hours (one full day)\n\nBest regards,\nMarcus Rivera\nSenior Reviewer, Elev8 Comply',
    line_items: [
      { id: 'li-1', description: 'Door gib set replacement — Elevator #2',          quantity: 1, unit: 'each',     unitPrice: 380, total:  380 },
      { id: 'li-2', description: 'Guide rail lubrication and adjustment',            quantity: 1, unit: 'each',     unitPrice: 220, total:  220 },
      { id: 'li-3', description: 'Safety brake test and certification',              quantity: 1, unit: 'each',     unitPrice: 450, total:  450 },
      { id: 'li-4', description: 'Annual inspection and California certificate',     quantity: 1, unit: 'each',     unitPrice: 425, total:  425 },
      { id: 'li-5', description: 'CAL/OSHA certified mechanic labor',                quantity: 6, unit: 'hrs',      unitPrice: 155, total:  930 },
      { id: 'li-6', description: 'Travel, disposal, and administrative fees',        quantity: 1, unit: 'lump sum', unitPrice: 115, total:  115 },
    ],
    total_amount: '2520.00',
    version: 1,
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }]);

  // Scheduling request
  const schedReqs = await dbInsert('scheduling_requests', [{
    job_id: job1.id,
    requested_by: client1Auth.id,
    status: 'pending',
    preferred_date_1: '2025-07-15',
    preferred_date_2: '2025-07-16',
    preferred_date_3: '2025-07-22',
    notes: 'Please schedule before 10am if possible. Building manager will be on site.',
  }]);
  const schedReq = schedReqs?.[0] ?? null;

  // Work orders
  await dbInsert('work_orders', [
    {
      job_id: job1.id,
      ...(schedReq ? { scheduling_request_id: schedReq.id } : {}),
      ...(tech1 ? { assigned_technician_id: tech1.id } : {}),
      created_by: dispatcherAuth.id,
      status: 'assigned',
      scheduled_start: '2025-07-15T08:00:00-07:00',
      scheduled_end:   '2025-07-15T17:00:00-07:00',
      region: 'Los Angeles',
      required_skill_tag: 'hydraulic',
      dispatch_notes: 'Access via freight elevator in parking garage (B1 level). Security desk on ground floor — ask for Alex Johnson.',
      forty_eight_hour_notice_required: true,
      forty_eight_hour_deadline: '2025-07-13T08:00:00-07:00',
      forty_eight_hour_status: 'pending',
      dispatch_packet: JSON.stringify({
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        buildingType: 'commercial',
        elevatorCount: 4,
        contactName: 'Alex Johnson',
        contactPhone: '310-555-0111',
        buildingAccessNotes: 'Freight elevator B1 level. Ask for Alex Johnson at security. Guest parking validated.',
        requiredScope: 'Replace door gibs on Elevator #2, lubricate guide rails, conduct safety brake test and annual certification.',
        violationItems: ['Annual inspection certificate expired', 'Door gibs worn beyond allowable tolerance', 'Guide rail lubrication required', 'Safety brake test overdue'],
        specialInstructions: 'Elevator #2 ONLY. Do not disable other units. Building hours 6am–10pm.',
        complianceNotes: '48-hr notice required to ABC Elevator Inspections: (310) 555-9900. Reference permit #WP-2025-442.',
        requiredSkillTag: 'hydraulic',
      }),
    },
    {
      job_id: job5.id,
      ...(tech1 ? { assigned_technician_id: tech1.id } : {}),
      created_by: dispatcherAuth.id,
      status: 'completed',
      scheduled_start: '2025-06-01T08:00:00-07:00',
      scheduled_end:   '2025-06-01T16:00:00-07:00',
      region: 'Los Angeles',
      required_skill_tag: 'hydraulic',
      forty_eight_hour_notice_required: false,
      forty_eight_hour_status: 'not_required',
      completion_notes: 'Annual inspection complete for Elevator #1. All systems within tolerance. New certificate issued through June 2026.',
      completed_at: '2025-06-01T15:30:00-07:00',
      dispatch_packet: JSON.stringify({
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        contactName: 'Alex Johnson',
        contactPhone: '310-555-0111',
        requiredScope: 'Annual inspection Elevator #1',
        violationItems: [],
        requiredSkillTag: 'hydraulic',
      }),
    },
  ]);

  // ── Activity logs ─────────────────────────────────────────────────────────────
  console.log('  [9/9] Activity logs…');
  await dbInsert('activity_logs', [
    { entity_type: 'notice', entity_id: notice1.id, event_type: 'notice_received',     description: 'Notice uploaded: OTC_WestsidePlaza_Elev2_2025.pdf',                    actor_id: client1Auth.id },
    { entity_type: 'notice', entity_id: notice1.id, event_type: 'notice_parsed',       description: 'AI parsing complete. Confidence: 94%. 4 violations extracted.',          actor_id: null },
    { entity_type: 'job',    entity_id: job1.id,    event_type: 'job_created',          description: 'Job created from notice: Annual Inspection & Door Gib Replacement',      actor_id: reviewerAuth.id },
    { entity_type: 'job',    entity_id: job1.id,    event_type: 'reviewer_assigned',    description: 'Reviewer assigned: Marcus Rivera (high urgency, commercial)',             actor_id: null },
    { entity_type: 'job',    entity_id: job1.id,    event_type: 'proposal_drafted',     description: 'Proposal drafted by Marcus Rivera — $2,520.00',                         actor_id: reviewerAuth.id },
    { entity_type: 'job',    entity_id: job1.id,    event_type: 'proposal_sent',        description: 'Proposal sent to client@westsideproperties.com',                         actor_id: reviewerAuth.id },
    { entity_type: 'job',    entity_id: job1.id,    event_type: 'scheduling_requested', description: 'Client submitted scheduling request. Preferred: July 15, 16, 22.',       actor_id: client1Auth.id },
    { entity_type: 'notice', entity_id: notice2.id, event_type: 'notice_received',     description: 'Notice received via email intake: CAL_OSHA_HarborTower_Critical_2025.pdf', actor_id: null },
    { entity_type: 'job',    entity_id: job2.id,    event_type: 'job_created',          description: 'Job created: Critical CAL/OSHA Compliance — Harbor Tower',               actor_id: adminAuth.id },
    { entity_type: 'job',    entity_id: job2.id,    event_type: 'escalation_triggered', description: 'Critical urgency detected — escalated to Sarah Chen (admin)',             actor_id: null },
    { entity_type: 'job',    entity_id: job5.id,    event_type: 'work_completed',       description: 'Work completed by David Kim. Elevator #1 annual inspection done.',        actor_id: tech1Auth.id },
  ]);

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅  SEED COMPLETE');
  console.log('═'.repeat(60));
  console.log('  Admin:       admin@elev8comply.com          Admin1234!');
  console.log('  Reviewer:    reviewer@elev8comply.com       Review1234!');
  console.log('  Dispatcher:  dispatcher@elev8comply.com     Dispatch1234!');
  console.log('  Technician:  tech1@elev8comply.com          Tech1234!');
  console.log('  Client:      client@westsideproperties.com  Client1234!');
  console.log('═'.repeat(60));
  console.log('  3 accounts · 7 users · 2 technicians · 4 properties');
  console.log('  4 notices · 5 jobs · 1 proposal ($2,520) · 2 work orders');
  console.log('═'.repeat(60) + '\n');
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message ?? err);
  if (err.cause) console.error('    Cause:', err.cause?.message ?? err.cause);
  if (err.code)  console.error('    Code: ', err.code);
  process.exit(1);
});
