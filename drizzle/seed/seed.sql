-- ============================================================
-- ELEV8 COMPLY — Seed Data
-- Paste this entire file into Supabase SQL Editor and click Run
-- ============================================================

-- Fixed UUIDs so foreign keys resolve correctly
DO $$
DECLARE
  -- Accounts
  acct1_id UUID := 'a0000001-0000-0000-0000-000000000001';
  acct2_id UUID := 'a0000002-0000-0000-0000-000000000002';

  -- Users (these must match auth.users IDs — see Step 2 below)
  -- After creating auth users, update these UUIDs to match
  admin_id    UUID := '00000000-0000-0000-0000-000000000001';
  reviewer_id UUID := '00000000-0000-0000-0000-000000000002';
  dispatch_id UUID := '00000000-0000-0000-0000-000000000003';
  tech1_id    UUID := '00000000-0000-0000-0000-000000000004';
  client_id   UUID := '00000000-0000-0000-0000-000000000005';

  -- Properties
  prop1_id UUID := 'b0000001-0000-0000-0000-000000000001';
  prop2_id UUID := 'b0000002-0000-0000-0000-000000000002';

  -- Technicians
  tech1_rec_id UUID := 'c0000001-0000-0000-0000-000000000001';

  -- Notices
  notice1_id UUID := 'd0000001-0000-0000-0000-000000000001';
  notice2_id UUID := 'd0000002-0000-0000-0000-000000000002';

  -- Jobs
  job1_id UUID := 'e0000001-0000-0000-0000-000000000001';
  job2_id UUID := 'e0000002-0000-0000-0000-000000000002';

  -- Proposal template + proposal
  template1_id UUID := 'f0000001-0000-0000-0000-000000000001';
  proposal1_id UUID := 'f0000002-0000-0000-0000-000000000002';

  -- Scheduling + Work Order
  sched1_id UUID := 'f1000001-0000-0000-0000-000000000001';
  wo1_id    UUID := 'f2000001-0000-0000-0000-000000000001';

BEGIN

-- ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
INSERT INTO accounts (id, name, email, phone, city, state)
VALUES
  (acct1_id, 'Westside Properties LLC', 'ops@westsideproperties.com', '310-555-0101', 'Los Angeles', 'CA'),
  (acct2_id, 'Harbor View Realty',      'compliance@harborview.com',  '562-555-0202', 'Long Beach',  'CA')
ON CONFLICT (id) DO NOTHING;


-- ─── CONTACTS ─────────────────────────────────────────────────────────────────
INSERT INTO contacts (id, account_id, full_name, email, phone, title, is_primary)
VALUES
  (gen_random_uuid(), acct1_id, 'Alex Johnson',  'client@westsideproperties.com', '310-555-0111', 'Property Manager',  true),
  (gen_random_uuid(), acct2_id, 'Brianna Lee',   'brianna@harborview.com',        '562-555-0211', 'Compliance Officer', true)
ON CONFLICT DO NOTHING;


-- ─── PROPERTIES ───────────────────────────────────────────────────────────────
INSERT INTO properties (id, account_id, name, address, city, state, zip, building_type, elevator_count)
VALUES
  (prop1_id, acct1_id, 'Westside Plaza',        '1200 Wilshire Blvd', 'Los Angeles',   'CA', '90025', 'commercial',  4),
  (prop2_id, acct1_id, 'Ocean View Residences', '8800 Lincoln Blvd',  'Marina del Rey','CA', '90292', 'residential', 2)
ON CONFLICT (id) DO NOTHING;


-- ─── NOTE: Auth users must be created FIRST in Supabase Dashboard ─────────────
-- Go to Authentication → Users → Add user for each email below:
--
--   admin@elev8comply.com          password: Admin1234!
--   reviewer@elev8comply.com       password: Review1234!
--   dispatcher@elev8comply.com     password: Dispatch1234!
--   tech1@elev8comply.com          password: Tech1234!
--   client@westsideproperties.com  password: Client1234!
--
-- AFTER creating those users, come back and run the rest of this file.
-- The trigger (handle_new_auth_user) will auto-create rows in public.users.
-- Then update the user metadata using the UPDATE statements at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── UPDATE USER ROLES (run after creating auth users) ───────────────────────
-- Set roles and account links on the public.users rows created by the trigger
UPDATE users SET role = 'admin'      WHERE email = 'admin@elev8comply.com';
UPDATE users SET role = 'reviewer'   WHERE email = 'reviewer@elev8comply.com';
UPDATE users SET role = 'dispatcher' WHERE email = 'dispatcher@elev8comply.com';
UPDATE users SET role = 'technician' WHERE email = 'tech1@elev8comply.com';
UPDATE users SET role = 'client', account_id = acct1_id
  WHERE email = 'client@westsideproperties.com';

-- Update full names
UPDATE users SET full_name = 'Sarah Chen'    WHERE email = 'admin@elev8comply.com';
UPDATE users SET full_name = 'Marcus Rivera' WHERE email = 'reviewer@elev8comply.com';
UPDATE users SET full_name = 'Jamie Torres'  WHERE email = 'dispatcher@elev8comply.com';
UPDATE users SET full_name = 'David Kim'     WHERE email = 'tech1@elev8comply.com';
UPDATE users SET full_name = 'Alex Johnson'  WHERE email = 'client@westsideproperties.com';


-- ─── TECHNICIAN RECORD ────────────────────────────────────────────────────────
INSERT INTO technicians (id, user_id, employee_id, full_name, email, phone, skill_tags, regions)
SELECT
  'c0000001-0000-0000-0000-000000000001',
  id,
  'EMP-001',
  'David Kim',
  'tech1@elev8comply.com',
  '213-555-1001',
  ARRAY['hydraulic','traction','mrl'],
  ARRAY['Los Angeles','Orange County']
FROM users WHERE email = 'tech1@elev8comply.com'
ON CONFLICT (user_id) DO NOTHING;


-- ─── NOTICES ──────────────────────────────────────────────────────────────────
INSERT INTO notices (
  id, account_id, property_id, submitted_by, intake_method, status,
  file_name, file_size, mime_type, urgency, state_deadline,
  assigned_reviewer_id, raw_text, parsed_data
)
SELECT
  'd0000001-0000-0000-0000-000000000001',
  acct1_id,
  prop1_id,
  (SELECT id FROM users WHERE email = 'client@westsideproperties.com'),
  'portal_upload',
  'parsed',
  'OTC_WestsidePlaza_2025.pdf',
  245000,
  'application/pdf',
  'high',
  '2025-08-15 00:00:00+00',
  (SELECT id FROM users WHERE email = 'reviewer@elev8comply.com'),
  'ORDER TO COMPLY - Westside Plaza, 1200 Wilshire Blvd, Los Angeles CA. Violation: Elevator #2 annual inspection overdue.',
  '{
    "documentType": "Order to Comply",
    "clientCompany": "Westside Properties LLC",
    "propertyName": "Westside Plaza",
    "propertyAddress": "1200 Wilshire Blvd, Los Angeles CA 90025",
    "buildingType": "commercial",
    "inspectionDate": "2025-05-10",
    "stateDeadline": "2025-08-15",
    "requiredWorkSummary": "Replace worn door gibs, lubricate guide rails, test safeties on Elevator #2",
    "detailedScope": "Full safety inspection on hydraulic elevator unit #2. Annual inspection overdue.",
    "violationItems": ["Annual inspection overdue", "Worn door gibs", "Guide rail lubrication required"],
    "workType": "Annual inspection and maintenance",
    "requiredSkillTag": "hydraulic",
    "estimatedDurationHours": 8,
    "estimatedLaborHours": 6,
    "estimatedMaterials": 850,
    "urgency": "high",
    "fortyEightHourRequired": true,
    "complianceCoordinationRequired": true,
    "missingInformation": [],
    "parseConfidence": 0.92
  }'::jsonb
ON CONFLICT (id) DO NOTHING;

INSERT INTO notices (id, account_id, intake_method, status, file_name, urgency, state_deadline, assigned_reviewer_id)
SELECT
  'd0000002-0000-0000-0000-000000000002',
  acct2_id,
  'email_intake',
  'review_pending',
  'CAL_OSHA_HarborTower_Notice.pdf',
  'critical',
  '2025-07-01 00:00:00+00',
  (SELECT id FROM users WHERE email = 'admin@elev8comply.com')
ON CONFLICT (id) DO NOTHING;


-- ─── JOBS ─────────────────────────────────────────────────────────────────────
INSERT INTO jobs (
  id, notice_id, account_id, property_id, assigned_reviewer_id,
  stage, urgency, title, next_action_date,
  building_type, required_skill_tag,
  estimated_duration_hours, estimated_labor_hours, estimated_materials_cost,
  forty_eight_hour_required, compliance_coordination_required, risk_flags
)
SELECT
  'e0000001-0000-0000-0000-000000000001',
  notice1_id,
  acct1_id,
  prop1_id,
  (SELECT id FROM users WHERE email = 'reviewer@elev8comply.com'),
  'proposal_sent',
  'high',
  'Annual Inspection & Maintenance – Westside Plaza',
  '2025-07-10',
  'commercial',
  'hydraulic',
  8, 6, 850,
  true, true,
  '[]'::jsonb
ON CONFLICT (id) DO NOTHING;

INSERT INTO jobs (
  id, notice_id, account_id, assigned_reviewer_id,
  stage, urgency, title, next_action_date,
  building_type, required_skill_tag,
  forty_eight_hour_required, compliance_coordination_required, risk_flags
)
SELECT
  'e0000002-0000-0000-0000-000000000002',
  notice2_id,
  acct2_id,
  (SELECT id FROM users WHERE email = 'admin@elev8comply.com'),
  'under_review',
  'critical',
  'CAL/OSHA Compliance – Harbor Tower',
  '2025-06-25',
  'commercial',
  'traction',
  true, true,
  '["critical_urgency","deadline_imminent"]'::jsonb
ON CONFLICT (id) DO NOTHING;


-- ─── PROPOSAL TEMPLATE ────────────────────────────────────────────────────────
INSERT INTO proposal_templates (id, name, work_type, body_template, default_line_items)
VALUES (
  'f0000001-0000-0000-0000-000000000001',
  'Standard Commercial Elevator Service',
  'annual_inspection',
  'Dear {{clientName}},

Thank you for submitting the Order to Comply notice for {{propertyName}}.

SCOPE OF WORK:
{{scope}}

All work performed by certified elevator mechanics per California regulations.

Best regards,
Elev8 Comply',
  '[
    {"id":"li-1","description":"Elevator inspection and certification","quantity":1,"unit":"each","unitPrice":450,"total":450},
    {"id":"li-2","description":"Labor – certified elevator mechanic","quantity":6,"unit":"hrs","unitPrice":145,"total":870},
    {"id":"li-3","description":"Materials and parts","quantity":1,"unit":"lump sum","unitPrice":850,"total":850}
  ]'::jsonb
) ON CONFLICT (id) DO NOTHING;


-- ─── PROPOSAL ─────────────────────────────────────────────────────────────────
INSERT INTO proposals (
  id, job_id, drafted_by, status, title, body,
  line_items, total_amount, version, sent_at, expires_at
)
SELECT
  'f0000002-0000-0000-0000-000000000002',
  job1_id,
  (SELECT id FROM users WHERE email = 'reviewer@elev8comply.com'),
  'sent',
  'Proposal – Annual Inspection & Maintenance – Westside Plaza',
  'Dear Alex Johnson,

We have reviewed the Order to Comply notice for Westside Plaza and propose the following work.

SCOPE: Replace worn door gibs on Elevator #2, lubricate guide rails, full safety test and annual certification.

Please review and approve at your convenience.

Best regards,
Elev8 Comply',
  '[
    {"id":"li-1","description":"Door gib replacement – Elevator #2","quantity":1,"unit":"each","unitPrice":380,"total":380},
    {"id":"li-2","description":"Guide rail lubrication","quantity":1,"unit":"each","unitPrice":220,"total":220},
    {"id":"li-3","description":"Safety test and annual certification","quantity":1,"unit":"each","unitPrice":450,"total":450},
    {"id":"li-4","description":"Certified mechanic labor","quantity":6,"unit":"hrs","unitPrice":145,"total":870}
  ]'::jsonb,
  1920.00,
  1,
  NOW(),
  NOW() + INTERVAL '30 days'
ON CONFLICT (id) DO NOTHING;


-- ─── SCHEDULING REQUEST ───────────────────────────────────────────────────────
INSERT INTO scheduling_requests (
  id, job_id, requested_by, status,
  preferred_date_1, preferred_date_2, preferred_date_3, notes
)
SELECT
  'f1000001-0000-0000-0000-000000000001',
  job1_id,
  (SELECT id FROM users WHERE email = 'client@westsideproperties.com'),
  'pending',
  '2025-07-15', '2025-07-16', '2025-07-22',
  'Please schedule before 10am. Building manager will be on site.'
ON CONFLICT (id) DO NOTHING;


-- ─── WORK ORDER ───────────────────────────────────────────────────────────────
INSERT INTO work_orders (
  id, job_id, scheduling_request_id, assigned_technician_id, created_by,
  status, scheduled_start, scheduled_end,
  region, required_skill_tag, dispatch_notes,
  forty_eight_hour_notice_required, forty_eight_hour_deadline, forty_eight_hour_status,
  dispatch_packet
)
SELECT
  'f2000001-0000-0000-0000-000000000001',
  job1_id,
  sched1_id,
  'c0000001-0000-0000-0000-000000000001',
  (SELECT id FROM users WHERE email = 'dispatcher@elev8comply.com'),
  'assigned',
  '2025-07-15 08:00:00-07',
  '2025-07-15 17:00:00-07',
  'Los Angeles',
  'hydraulic',
  'Access via freight elevator. Contact Alex Johnson on arrival.',
  true,
  '2025-07-13 08:00:00-07',
  'pending',
  '{"propertyName":"Westside Plaza","propertyAddress":"1200 Wilshire Blvd, Los Angeles CA 90025","buildingType":"commercial","elevatorCount":4,"contactName":"Alex Johnson","contactPhone":"310-555-0111","buildingAccessNotes":"Use freight elevator. Security desk on ground floor.","requiredScope":"Replace door gibs, lubricate guide rails, safety test","violationItems":["Worn door gibs","Guide rail lubrication required"],"specialInstructions":"Elevator #2 only.","complianceNotes":"48-hr notice required to ABC Elevator Inspections","requiredSkillTag":"hydraulic"}'
ON CONFLICT (id) DO NOTHING;


-- ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────
INSERT INTO activity_logs (entity_type, entity_id, event_type, description, actor_id)
SELECT 'notice', notice1_id, 'notice_received',  'Notice uploaded: OTC_WestsidePlaza_2025.pdf', (SELECT id FROM users WHERE email = 'client@westsideproperties.com');

INSERT INTO activity_logs (entity_type, entity_id, event_type, description, actor_id)
VALUES ('notice', 'd0000001-0000-0000-0000-000000000001', 'notice_parsed', 'AI parsing complete. Confidence: 92%', NULL);

INSERT INTO activity_logs (entity_type, entity_id, event_type, description, actor_id)
SELECT 'job', job1_id, 'job_created', 'Job created from notice: Annual Inspection & Maintenance – Westside Plaza', (SELECT id FROM users WHERE email = 'admin@elev8comply.com');

INSERT INTO activity_logs (entity_type, entity_id, event_type, description, actor_id)
SELECT 'job', job1_id, 'proposal_sent', 'Proposal sent to Alex Johnson', (SELECT id FROM users WHERE email = 'reviewer@elev8comply.com');

INSERT INTO activity_logs (entity_type, entity_id, event_type, description, actor_id)
SELECT 'job', job2_id, 'escalation_triggered', 'Critical urgency – assigned to admin reviewer', NULL;

END $$;

-- ─── VERIFY ───────────────────────────────────────────────────────────────────
SELECT 'accounts'   AS table_name, COUNT(*) AS rows FROM accounts
UNION ALL SELECT 'properties',  COUNT(*) FROM properties
UNION ALL SELECT 'notices',     COUNT(*) FROM notices
UNION ALL SELECT 'jobs',        COUNT(*) FROM jobs
UNION ALL SELECT 'proposals',   COUNT(*) FROM proposals
UNION ALL SELECT 'work_orders', COUNT(*) FROM work_orders
UNION ALL SELECT 'users',       COUNT(*) FROM users;
