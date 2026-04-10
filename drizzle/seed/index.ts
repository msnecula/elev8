// Force IPv4 — prevents ETIMEDOUT on Windows
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL required');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY required');

const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL required in .env.local');

const pgClient = postgres(dbUrl, { prepare: false });
const db = drizzle(pgClient, { schema });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createAuthUser(
  email: string,
  password: string,
  meta: Record<string, string>
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      const { data: list } = await supabase.auth.admin.listUsers();
      return list.users.find(u => u.email === email)!;
    }
    throw new Error(`Auth create failed for ${email}: ${error.message}`);
  }
  return data.user!;
}

async function seed() {
  console.log('\n🌱 Seeding Elev8 Comply database…\n');

  // ── Accounts ────────────────────────────────────────────────────────────────
  console.log('  Creating accounts…');
  const [acct1, acct2, acct3] = await db.insert(schema.accounts).values([
    {
      name: 'Westside Properties LLC',
      email: 'ops@westsideproperties.com',
      phone: '310-555-0101',
      address: '9999 Wilshire Blvd Ste 400',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90025',
    },
    {
      name: 'Harbor View Realty',
      email: 'compliance@harborview.com',
      phone: '562-555-0202',
      city: 'Long Beach',
      state: 'CA',
      zip: '90802',
    },
    {
      name: 'Summit Tower Group',
      email: 'management@summittower.com',
      phone: '213-555-0303',
      city: 'Los Angeles',
      state: 'CA',
    },
  ]).returning({ id: schema.accounts.id, name: schema.accounts.name }).onConflictDoNothing();

  if (!acct1 || !acct2 || !acct3) {
    console.log('  ⚠  Accounts already exist — skipping user creation to avoid duplicates');
    console.log('\n✅ Seed skipped (already seeded). Run from fresh DB to re-seed.\n');
    await pgClient.end();
    return;
  }

  // ── Auth users ───────────────────────────────────────────────────────────────
  console.log('  Creating auth users…');
  const adminAuth      = await createAuthUser('admin@elev8comply.com',         'Admin1234!',    { full_name: 'Sarah Chen',    role: 'admin' });
  const reviewerAuth   = await createAuthUser('reviewer@elev8comply.com',      'Review1234!',   { full_name: 'Marcus Rivera', role: 'reviewer' });
  const dispatcherAuth = await createAuthUser('dispatcher@elev8comply.com',    'Dispatch1234!', { full_name: 'Jamie Torres',  role: 'dispatcher' });
  const tech1Auth      = await createAuthUser('tech1@elev8comply.com',         'Tech1234!',     { full_name: 'David Kim',     role: 'technician' });
  const tech2Auth      = await createAuthUser('tech2@elev8comply.com',         'Tech1234!',     { full_name: 'Rosa Martinez', role: 'technician' });
  const client1Auth    = await createAuthUser('client@westsideproperties.com', 'Client1234!',   { full_name: 'Alex Johnson',  role: 'client', account_id: acct1.id });
  const client2Auth    = await createAuthUser('client@harborview.com',         'Client1234!',   { full_name: 'Brianna Lee',   role: 'client', account_id: acct2.id });

  // ── Public users ─────────────────────────────────────────────────────────────
  console.log('  Upserting public users…');
  await db.insert(schema.users).values([
    { id: adminAuth.id,      email: 'admin@elev8comply.com',         fullName: 'Sarah Chen',    role: 'admin' },
    { id: reviewerAuth.id,   email: 'reviewer@elev8comply.com',      fullName: 'Marcus Rivera', role: 'reviewer' },
    { id: dispatcherAuth.id, email: 'dispatcher@elev8comply.com',    fullName: 'Jamie Torres',  role: 'dispatcher' },
    { id: tech1Auth.id,      email: 'tech1@elev8comply.com',         fullName: 'David Kim',     role: 'technician' },
    { id: tech2Auth.id,      email: 'tech2@elev8comply.com',         fullName: 'Rosa Martinez', role: 'technician' },
    { id: client1Auth.id,    email: 'client@westsideproperties.com', fullName: 'Alex Johnson',  role: 'client', accountId: acct1.id },
    { id: client2Auth.id,    email: 'client@harborview.com',         fullName: 'Brianna Lee',   role: 'client', accountId: acct2.id },
  ]).onConflictDoNothing();

  // ── Technicians ──────────────────────────────────────────────────────────────
  console.log('  Creating technicians…');
  const [tech1, tech2] = await db.insert(schema.technicians).values([
    {
      userId: tech1Auth.id,
      employeeId: 'EMP-001',
      fullName: 'David Kim',
      email: 'tech1@elev8comply.com',
      phone: '213-555-1001',
      skillTags: ['hydraulic', 'traction', 'mrl', 'commercial'],
      regions: ['Los Angeles', 'Orange County'],
    },
    {
      userId: tech2Auth.id,
      employeeId: 'EMP-002',
      fullName: 'Rosa Martinez',
      email: 'tech2@elev8comply.com',
      phone: '213-555-1002',
      skillTags: ['escalator', 'traction', 'residential', 'commercial'],
      regions: ['Los Angeles', 'San Bernardino', 'Riverside'],
    },
  ]).returning({ id: schema.technicians.id }).onConflictDoNothing();

  // ── Contacts ─────────────────────────────────────────────────────────────────
  console.log('  Creating contacts…');
  await db.insert(schema.contacts).values([
    { accountId: acct1.id, fullName: 'Alex Johnson',  email: 'client@westsideproperties.com', phone: '310-555-0111', title: 'Property Manager',  isPrimary: true },
    { accountId: acct1.id, fullName: 'Dana Lee',      email: 'dana@westsideproperties.com',   phone: '310-555-0112', title: 'Facilities Director', isPrimary: false },
    { accountId: acct2.id, fullName: 'Brianna Lee',   email: 'client@harborview.com',         phone: '562-555-0211', title: 'Compliance Officer', isPrimary: true },
    { accountId: acct3.id, fullName: 'Carlos Mendez', email: 'carlos@summittower.com',        phone: '213-555-0311', title: 'Building Manager',   isPrimary: true },
  ]).onConflictDoNothing();

  // ── Properties ────────────────────────────────────────────────────────────────
  console.log('  Creating properties…');
  const [prop1, prop2, prop3, prop4] = await db.insert(schema.properties).values([
    { accountId: acct1.id, name: 'Westside Plaza',        address: '1200 Wilshire Blvd',  city: 'Los Angeles',   state: 'CA', zip: '90025', buildingType: 'commercial',  elevatorCount: 4 },
    { accountId: acct1.id, name: 'Ocean View Residences', address: '8800 Lincoln Blvd',   city: 'Marina del Rey',state: 'CA', zip: '90292', buildingType: 'residential', elevatorCount: 2 },
    { accountId: acct2.id, name: 'Harbor Tower',          address: '400 Ocean Blvd',      city: 'Long Beach',    state: 'CA', zip: '90802', buildingType: 'commercial',  elevatorCount: 6 },
    { accountId: acct3.id, name: 'Summit Center',         address: '333 S Grand Ave',     city: 'Los Angeles',   state: 'CA', zip: '90071', buildingType: 'commercial',  elevatorCount: 8 },
  ]).returning({ id: schema.properties.id }).onConflictDoNothing();

  // ── Proposal templates ───────────────────────────────────────────────────────
  console.log('  Creating proposal templates…');
  await db.insert(schema.proposalTemplates).values([
    {
      name: 'Standard Commercial Elevator Service',
      workType: 'annual_inspection',
      bodyTemplate: `Dear {{clientName}},

Thank you for submitting the Order to Comply notice for {{propertyName}}.

We have reviewed the violations identified during the inspection and are pleased to provide this proposal to bring your elevator(s) into full compliance with California state regulations.

SCOPE OF WORK:
{{scope}}

All work will be performed by our CAL/OSHA certified elevator mechanics in accordance with California Code of Regulations Title 8, ASME A17.1 Safety Code for Elevators and Escalators, and all applicable local ordinances.

Upon completion, we will provide a written certificate of compliance for your records.

Please review the pricing breakdown on the following page and contact us with any questions.

We look forward to serving you.

Sincerely,
Elev8 Comply`,
      defaultLineItems: [
        { id: 'li-1', description: 'Elevator safety inspection and annual certification', quantity: 1, unit: 'each', unitPrice: 450, total: 450 },
        { id: 'li-2', description: 'Labor — CAL/OSHA certified elevator mechanic', quantity: 6, unit: 'hrs', unitPrice: 155, total: 930 },
        { id: 'li-3', description: 'Materials and replacement parts', quantity: 1, unit: 'lump sum', unitPrice: 850, total: 850 },
        { id: 'li-4', description: 'Compliance documentation package', quantity: 1, unit: 'each', unitPrice: 125, total: 125 },
      ],
    },
    {
      name: 'Residential Elevator Compliance',
      workType: 'violation_correction',
      bodyTemplate: `Dear {{clientName}},

We are pleased to provide this proposal for elevator compliance work at {{propertyName}}.

Our team has reviewed the Order to Comply notice and identified all required corrective actions.

PROPOSED WORK:
{{scope}}

Our technicians will coordinate with your building management to schedule the work at a time that minimizes disruption to residents.

Best regards,
Elev8 Comply`,
      defaultLineItems: [
        { id: 'li-1', description: 'Compliance assessment and scope documentation', quantity: 1, unit: 'each', unitPrice: 350, total: 350 },
        { id: 'li-2', description: 'Repair and correction labor', quantity: 4, unit: 'hrs', unitPrice: 155, total: 620 },
        { id: 'li-3', description: 'Parts and materials', quantity: 1, unit: 'lump sum', unitPrice: 400, total: 400 },
      ],
    },
    {
      name: 'Emergency / Critical Compliance',
      workType: 'emergency_repair',
      bodyTemplate: `Dear {{clientName}},

Given the critical nature of the Order to Comply notice received for {{propertyName}}, we have prioritized your job for immediate attention.

EMERGENCY SCOPE:
{{scope}}

Due to the compliance deadline, we recommend proceeding immediately. Our team is available to mobilize within 48 hours of proposal approval.

Urgently,
Elev8 Comply`,
      defaultLineItems: [
        { id: 'li-1', description: 'Emergency response and priority scheduling', quantity: 1, unit: 'each', unitPrice: 350, total: 350 },
        { id: 'li-2', description: 'Emergency repair labor (priority rate)', quantity: 8, unit: 'hrs', unitPrice: 185, total: 1480 },
        { id: 'li-3', description: 'Emergency parts procurement and materials', quantity: 1, unit: 'lump sum', unitPrice: 1200, total: 1200 },
        { id: 'li-4', description: 'Compliance filing and documentation', quantity: 1, unit: 'each', unitPrice: 200, total: 200 },
      ],
    },
  ]).onConflictDoNothing();

  // ── Notices ───────────────────────────────────────────────────────────────────
  console.log('  Creating notices…');
  const [notice1, notice2, notice3, notice4] = await db.insert(schema.notices).values([
    {
      accountId: acct1.id,
      propertyId: prop1!.id,
      submittedBy: client1Auth.id,
      intakeMethod: 'portal_upload',
      status: 'parsed',
      fileName: 'OTC_WestsidePlaza_Elev2_2025.pdf',
      fileSize: 245000,
      mimeType: 'application/pdf',
      urgency: 'high',
      stateDeadline: new Date('2025-08-15'),
      assignedReviewerId: reviewerAuth.id,
      rawText: 'ORDER TO COMPLY — Westside Plaza, 1200 Wilshire Blvd, Los Angeles CA 90025. CAL/OSHA Division of Occupational Safety and Health. Elevator #2 (Serial: WP-ELV-002, Type: Hydraulic). Violations: Annual inspection overdue 4 months. Door gibs worn beyond tolerance. Guide rail lubrication required. Safety test overdue. Compliance deadline: August 15, 2025.',
      parsedData: {
        documentType: 'CAL/OSHA Order to Comply',
        clientCompany: 'Westside Properties LLC',
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        buildingType: 'commercial',
        inspectionDate: '2025-05-10',
        stateDeadline: '2025-08-15',
        requiredWorkSummary: 'Replace worn door gibs, lubricate guide rails, test safety brakes on Elevator #2',
        detailedScope: 'Full safety inspection and maintenance on hydraulic elevator unit #2 (Serial: WP-ELV-002). Annual inspection is overdue by 4 months. Door gibs show excessive wear. Guide rails require lubrication per manufacturer spec. Safety brake test is required before next operation.',
        violationItems: [
          'Annual inspection certificate expired (4 months overdue)',
          'Door gibs worn beyond allowable tolerance — Code Ref: 2.1.2.4',
          'Guide rail lubrication required — Code Ref: 2.15.4',
          'Safety brake test overdue — Code Ref: 3.26.2',
        ],
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
      accountId: acct2.id,
      propertyId: prop3!.id,
      submittedBy: null,
      intakeMethod: 'email_intake',
      status: 'review_pending',
      fileName: 'CAL_OSHA_HarborTower_Critical_2025.pdf',
      fileSize: 312000,
      mimeType: 'application/pdf',
      urgency: 'critical',
      stateDeadline: new Date('2025-07-01'),
      assignedReviewerId: adminAuth.id,
    },
    {
      accountId: acct1.id,
      propertyId: prop2!.id,
      submittedBy: client1Auth.id,
      intakeMethod: 'portal_upload',
      status: 'received',
      fileName: 'OTC_OceanView_June2025.pdf',
      fileSize: 198000,
      mimeType: 'application/pdf',
      urgency: 'medium',
    },
    {
      accountId: acct3.id,
      propertyId: prop4!.id,
      submittedBy: null,
      intakeMethod: 'email_intake',
      status: 'parsed',
      fileName: 'SummitCenter_Escalator_OTC.pdf',
      fileSize: 178000,
      mimeType: 'application/pdf',
      urgency: 'high',
      stateDeadline: new Date('2025-09-01'),
      assignedReviewerId: reviewerAuth.id,
      parsedData: {
        documentType: 'Order to Comply',
        clientCompany: 'Summit Tower Group',
        propertyName: 'Summit Center',
        propertyAddress: '333 S Grand Ave, Los Angeles CA 90071',
        buildingType: 'commercial',
        inspectionDate: '2025-04-20',
        stateDeadline: '2025-09-01',
        requiredWorkSummary: 'Escalator handrail speed fault and emergency stop test required',
        detailedScope: 'Escalator unit between floors 1-3. Handrail speed deviation detected. Emergency stop system test required.',
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
  ]).returning({ id: schema.notices.id }).onConflictDoNothing();

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  console.log('  Creating jobs…');
  const [job1, job2, job3, job4, job5] = await db.insert(schema.jobs).values([
    {
      // Job 1 — full pipeline, proposal sent, scheduling pending
      noticeId: notice1!.id,
      accountId: acct1.id,
      propertyId: prop1!.id,
      assignedReviewerId: reviewerAuth.id,
      stage: 'proposal_sent',
      urgency: 'high',
      title: 'Annual Inspection & Door Gib Replacement — Westside Plaza Elevator #2',
      nextActionDate: new Date('2025-07-10').toISOString().split('T')[0],
      buildingType: 'commercial',
      requiredSkillTag: 'hydraulic',
      estimatedDurationHours: '8',
      estimatedLaborHours: '6',
      estimatedMaterialsCost: '850',
      fortyEightHourRequired: true,
      complianceCoordinationRequired: true,
      riskFlags: [],
    },
    {
      // Job 2 — critical, under review
      noticeId: notice2!.id,
      accountId: acct2.id,
      propertyId: prop3!.id,
      assignedReviewerId: adminAuth.id,
      stage: 'under_review',
      urgency: 'critical',
      title: 'Critical CAL/OSHA Compliance — Harbor Tower (All Elevators)',
      nextActionDate: new Date('2025-06-25').toISOString().split('T')[0],
      buildingType: 'commercial',
      requiredSkillTag: 'traction',
      fortyEightHourRequired: true,
      complianceCoordinationRequired: true,
      riskFlags: ['critical_urgency', 'deadline_imminent'],
    },
    {
      // Job 3 — newly received
      noticeId: notice3!.id,
      accountId: acct1.id,
      propertyId: prop2!.id,
      assignedReviewerId: reviewerAuth.id,
      stage: 'notice_received',
      urgency: 'medium',
      title: 'Elevator Compliance Review — Ocean View Residences',
      buildingType: 'residential',
      requiredSkillTag: 'hydraulic',
      riskFlags: [],
    },
    {
      // Job 4 — approved, ready to schedule
      noticeId: notice4!.id,
      accountId: acct3.id,
      propertyId: prop4!.id,
      assignedReviewerId: reviewerAuth.id,
      stage: 'approved',
      urgency: 'high',
      title: 'Escalator Maintenance & Safety Test — Summit Center',
      nextActionDate: new Date('2025-07-20').toISOString().split('T')[0],
      buildingType: 'commercial',
      requiredSkillTag: 'escalator',
      estimatedDurationHours: '6',
      estimatedLaborHours: '5',
      estimatedMaterialsCost: '600',
      fortyEightHourRequired: false,
      complianceCoordinationRequired: false,
      riskFlags: ['missing_info'],
    },
    {
      // Job 5 — completed example
      accountId: acct1.id,
      propertyId: prop1!.id,
      assignedReviewerId: reviewerAuth.id,
      stage: 'completed',
      urgency: 'medium',
      title: 'Annual Inspection — Westside Plaza Elevator #1',
      buildingType: 'commercial',
      requiredSkillTag: 'hydraulic',
      riskFlags: [],
    },
  ]).returning({ id: schema.jobs.id }).onConflictDoNothing();

  // ── Proposals ────────────────────────────────────────────────────────────────
  console.log('  Creating proposals…');
  const [proposal1] = await db.insert(schema.proposals).values([
    {
      jobId: job1!.id,
      draftedBy: reviewerAuth.id,
      status: 'sent',
      title: 'Proposal — Annual Inspection & Door Gib Replacement — Westside Plaza Elevator #2',
      body: `Dear Alex Johnson,

Thank you for submitting the Order to Comply notice for Westside Plaza (1200 Wilshire Blvd, Los Angeles CA 90025).

We have reviewed the CAL/OSHA inspection report and the violations identified for Elevator #2. We are pleased to provide this proposal to bring your elevator into full compliance.

SCOPE OF WORK:
• Replace worn door gibs on Elevator #2 (both landing and car door sides)
• Lubricate and adjust guide rails per manufacturer specification
• Conduct full safety brake test and certification per ASME A17.1
• Complete annual inspection and issue California compliance certificate

All work will be performed by our CAL/OSHA certified elevator mechanics. We will coordinate 48-hour advance notice with your compliance company (ABC Elevator Inspections) before work begins, as required by California regulations.

Estimated duration: 8 hours (one full day)

Please review the pricing below and click the approval link to proceed. Once approved, you can request your preferred scheduling dates through your client portal.

Thank you for choosing Elev8 Comply.

Best regards,
Marcus Rivera
Senior Reviewer, Elev8 Comply`,
      lineItems: [
        { id: 'li-1', description: 'Door gib set replacement — Elevator #2 (landing + car door)', quantity: 1, unit: 'each', unitPrice: 380, total: 380 },
        { id: 'li-2', description: 'Guide rail lubrication and adjustment (full rails)', quantity: 1, unit: 'each', unitPrice: 220, total: 220 },
        { id: 'li-3', description: 'Safety brake test and certification', quantity: 1, unit: 'each', unitPrice: 450, total: 450 },
        { id: 'li-4', description: 'Annual inspection and California compliance certificate', quantity: 1, unit: 'each', unitPrice: 425, total: 425 },
        { id: 'li-5', description: 'CAL/OSHA certified mechanic labor', quantity: 6, unit: 'hrs', unitPrice: 155, total: 930 },
        { id: 'li-6', description: 'Travel, disposal, and administrative fees', quantity: 1, unit: 'lump sum', unitPrice: 115, total: 115 },
      ],
      totalAmount: '2520.00',
      version: 1,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  ]).returning({ id: schema.proposals.id }).onConflictDoNothing();

  // ── Scheduling request ───────────────────────────────────────────────────────
  console.log('  Creating scheduling request…');
  const [schedReq] = await db.insert(schema.schedulingRequests).values([
    {
      jobId: job1!.id,
      requestedBy: client1Auth.id,
      status: 'pending',
      preferredDate1: new Date('2025-07-15').toISOString().split('T')[0],
      preferredDate2: new Date('2025-07-16').toISOString().split('T')[0],
      preferredDate3: new Date('2025-07-22').toISOString().split('T')[0],
      notes: 'Please schedule before 10am if possible. Building manager will be on site. Freight elevator available for equipment.',
    },
  ]).returning({ id: schema.schedulingRequests.id }).onConflictDoNothing();

  // ── Work order (for job 5 — completed) ───────────────────────────────────────
  console.log('  Creating work orders…');
  const scheduledStart = new Date('2025-06-01T08:00:00-07:00');
  const deadline48h = new Date(scheduledStart.getTime() - 48 * 60 * 60 * 1000);

  await db.insert(schema.workOrders).values([
    {
      // Work order for job 1 — assigned, awaiting dispatch
      jobId: job1!.id,
      schedulingRequestId: schedReq!.id,
      assignedTechnicianId: tech1!.id,
      createdBy: dispatcherAuth.id,
      status: 'assigned',
      scheduledStart: new Date('2025-07-15T08:00:00-07:00'),
      scheduledEnd: new Date('2025-07-15T17:00:00-07:00'),
      region: 'Los Angeles',
      requiredSkillTag: 'hydraulic',
      dispatchNotes: 'Access via freight elevator in parking garage (B1 level). Security desk on ground floor — ask for Alex Johnson or building security. Parking validated in guest lot.',
      fortyEightHourNoticeRequired: true,
      fortyEightHourDeadline: new Date('2025-07-13T08:00:00-07:00'),
      fortyEightHourStatus: 'pending',
      dispatchPacket: JSON.stringify({
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        buildingType: 'commercial',
        elevatorCount: 4,
        contactName: 'Alex Johnson',
        contactPhone: '310-555-0111',
        buildingAccessNotes: 'Freight elevator B1 level. Ask for Alex Johnson at security desk. Guest parking validated.',
        requiredScope: 'Replace door gibs on Elevator #2, lubricate guide rails, conduct safety brake test and annual certification.',
        violationItems: [
          'Annual inspection certificate expired (4 months overdue)',
          'Door gibs worn beyond allowable tolerance',
          'Guide rail lubrication required',
          'Safety brake test overdue',
        ],
        specialInstructions: 'Elevator #2 ONLY. Do not disable other units. Building hours 6am–10pm.',
        complianceNotes: '48-hr notice required to ABC Elevator Inspections: (310) 555-9900. Reference permit #WP-2025-442.',
        requiredSkillTag: 'hydraulic',
      }),
    },
    {
      // Completed work order for job 5
      jobId: job5!.id,
      assignedTechnicianId: tech1!.id,
      createdBy: dispatcherAuth.id,
      status: 'completed',
      scheduledStart,
      scheduledEnd: new Date('2025-06-01T16:00:00-07:00'),
      region: 'Los Angeles',
      requiredSkillTag: 'hydraulic',
      fortyEightHourNoticeRequired: false,
      fortyEightHourStatus: 'not_required',
      completionNotes: 'Annual inspection completed for Elevator #1. All systems within tolerance. New certificate issued, valid through June 2026. Minor adjustment made to door timing. No violations found.',
      completedAt: new Date('2025-06-01T15:30:00-07:00'),
      dispatchPacket: JSON.stringify({
        propertyName: 'Westside Plaza',
        propertyAddress: '1200 Wilshire Blvd, Los Angeles CA 90025',
        buildingType: 'commercial',
        elevatorCount: 4,
        contactName: 'Alex Johnson',
        contactPhone: '310-555-0111',
        buildingAccessNotes: '',
        requiredScope: 'Annual inspection Elevator #1',
        violationItems: [],
        specialInstructions: '',
        complianceNotes: '',
        requiredSkillTag: 'hydraulic',
      }),
    },
  ]).onConflictDoNothing();

  // ── Activity logs ────────────────────────────────────────────────────────────
  console.log('  Creating activity logs…');
  await db.insert(schema.activityLogs).values([
    { entityType: 'notice', entityId: notice1!.id, eventType: 'notice_received',        description: 'Notice uploaded: OTC_WestsidePlaza_Elev2_2025.pdf',             actorId: client1Auth.id },
    { entityType: 'notice', entityId: notice1!.id, eventType: 'notice_parsed',           description: 'AI parsing complete. Confidence: 94%. 4 violations extracted.',  actorId: null },
    { entityType: 'job',    entityId: job1!.id,    eventType: 'job_created',              description: 'Job created from notice: Annual Inspection & Door Gib Replacement', actorId: reviewerAuth.id },
    { entityType: 'job',    entityId: job1!.id,    eventType: 'reviewer_assigned',        description: 'Reviewer assigned: Marcus Rivera (high urgency, commercial)',      actorId: null },
    { entityType: 'job',    entityId: job1!.id,    eventType: 'proposal_drafted',         description: 'Proposal drafted by Marcus Rivera — $2,520.00',                   actorId: reviewerAuth.id },
    { entityType: 'job',    entityId: job1!.id,    eventType: 'proposal_sent',            description: 'Proposal sent to client: client@westsideproperties.com',           actorId: reviewerAuth.id },
    { entityType: 'job',    entityId: job1!.id,    eventType: 'scheduling_requested',     description: 'Client submitted scheduling request. Preferred: July 15, 16, 22',  actorId: client1Auth.id },
    { entityType: 'notice', entityId: notice2!.id, eventType: 'notice_received',         description: 'Notice received via email intake: CAL_OSHA_HarborTower_Critical_2025.pdf', actorId: null },
    { entityType: 'job',    entityId: job2!.id,    eventType: 'job_created',              description: 'Job created: Critical CAL/OSHA Compliance — Harbor Tower',        actorId: adminAuth.id },
    { entityType: 'job',    entityId: job2!.id,    eventType: 'escalation_triggered',     description: 'Critical urgency detected — assigned to admin reviewer (Sarah Chen)', actorId: null },
    { entityType: 'job',    entityId: job4!.id,    eventType: 'proposal_approved',        description: 'Proposal approved by client — escalator job ready for scheduling', actorId: null },
    { entityType: 'job',    entityId: job5!.id,    eventType: 'work_completed',           description: 'Work completed by David Kim. Elevator #1 annual inspection done.', actorId: tech1Auth.id },
  ]).onConflictDoNothing();

  console.log('\n✅ Seed complete!\n');
  console.log('═'.repeat(58));
  console.log(' TEST LOGIN CREDENTIALS');
  console.log('═'.repeat(58));
  console.log(' Admin:      admin@elev8comply.com         Admin1234!');
  console.log(' Reviewer:   reviewer@elev8comply.com      Review1234!');
  console.log(' Dispatcher: dispatcher@elev8comply.com    Dispatch1234!');
  console.log(' Technician: tech1@elev8comply.com         Tech1234!');
  console.log(' Client 1:   client@westsideproperties.com Client1234!');
  console.log(' Client 2:   client@harborview.com         Client1234!');
  console.log('═'.repeat(58));
  console.log('\n What you can do immediately:');
  console.log(' • Log in as Admin → see notices, jobs, dispatch dashboard');
  console.log(' • Log in as Client 1 → see Job 1 with pending proposal');
  console.log(' • Log in as Dispatcher → confirm scheduling for Job 1');
  console.log(' • Log in as Technician → see assigned work order');
  console.log('');

  await pgClient.end();
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
