# Elev8 Comply — QA Checklist & Production Deployment Guide

---

## Manual QA Checklist

Test the full workflow from notice to completed job using the seed data credentials.

### Auth Flows
- [ ] Login as admin@elev8comply.com / Admin1234! — lands on /notices
- [ ] Login as reviewer@elev8comply.com — lands on /notices
- [ ] Login as dispatcher@elev8comply.com — lands on /dispatch
- [ ] Login as tech1@elev8comply.com — lands on /technician
- [ ] Login as client@westsideproperties.com — lands on /client
- [ ] Forgot password flow sends reset email
- [ ] Reset password link works
- [ ] Signed-out users redirect to /login
- [ ] Client cannot access /notices, /jobs, /dispatch
- [ ] Technician cannot access /notices, /proposals, /dispatch

### Notice Intake (as Admin or Reviewer)
- [ ] Navigate to /notices/new
- [ ] Select account "Westside Properties LLC"
- [ ] Upload a PDF (use any PDF for testing)
- [ ] File upload progress shows correctly
- [ ] "Register Notice" creates a notice record
- [ ] "Parse with AI" triggers AI extraction
- [ ] Parsed data panel shows extracted fields
- [ ] AI confidence score is displayed
- [ ] Job is auto-created after parsing
- [ ] Notice status changes to "parsed"
- [ ] Job appears in /jobs list

### Job Management (as Reviewer)
- [ ] /jobs shows all jobs with correct stages
- [ ] Click job — detail page loads
- [ ] Stage selector dropdown works
- [ ] "Add Note" form saves and appears in activity log
- [ ] Risk flags displayed correctly
- [ ] Links to notice, proposals, work orders work

### Proposal Flow (as Reviewer)
- [ ] From job detail, click "New Proposal"
- [ ] "Draft with AI" generates title, body, and line items
- [ ] Line items calculate totals correctly
- [ ] Edit body text and save
- [ ] Add/remove line items
- [ ] "Save Proposal" persists changes
- [ ] Send proposal — status changes to "sent"
- [ ] Client receives email (check with real email if Resend configured)

### Client Portal (as Client 1)
- [ ] /client shows job summary cards and jobs table
- [ ] Action required banner shows for pending proposals
- [ ] Click job → /client/jobs/[id] loads correctly
- [ ] "Review & Approve" links to /client/proposals/[id]
- [ ] Proposal body and pricing breakdown visible
- [ ] Approve proposal — status changes, redirect to job
- [ ] Request changes — text box appears, notes submitted
- [ ] After approval, "Request Scheduling" button appears
- [ ] /client/schedule/[id] shows date preference form
- [ ] Submit scheduling request — pending banner shows

### Scheduling (as Dispatcher)
- [ ] /dispatch shows pending scheduling requests
- [ ] /schedule/[id] shows client's preferred dates
- [ ] Confirm date form works with datetime pickers
- [ ] Building access notes saved
- [ ] Confirm → client email sent (if Resend configured)
- [ ] Job stage updates to "scheduled"

### Work Order & Dispatch (as Dispatcher)
- [ ] From /jobs/[id] click "Create Work Order"
- [ ] Form pre-fills from confirmed scheduling
- [ ] Region and skill tag selectors work
- [ ] 48-hour toggle shows/hides deadline info
- [ ] Work order created → redirects to /work-orders/[id]
- [ ] "Find Technicians" loads scored matches
- [ ] Assign technician — work order status → "assigned"
- [ ] SMS notification logged in notifications table
- [ ] Dispatch button works — status → "dispatched"
- [ ] 48-hour panel shows deadline and mark-sent button
- [ ] "Mark Notice Sent" updates status to "sent"

### Technician Workflow (as Technician)
- [ ] /technician shows assigned work orders
- [ ] Work order card shows property, date, status
- [ ] Click work order → detail page loads
- [ ] Dispatch packet visible
- [ ] "Mark Ready" → status: ready
- [ ] "En Route" → status: en_route
- [ ] "On Site" → status: on_site
- [ ] "Complete Job" shows completion form
- [ ] Submit completion notes → status: completed
- [ ] Completed jobs appear in "Recently Completed"

### 48-Hour Notice Logic
- [ ] Work order with 48-hr required shows deadline
- [ ] Deadline within 24 hours shows amber warning
- [ ] Overdue deadline shows red banner
- [ ] Dispatch blocked when status = overdue
- [ ] Mark as sent updates status → "sent"
- [ ] Manual test: call /api/cron/48hour-sweep with CRON_SECRET

### Settings (as Admin)
- [ ] /settings loads user list
- [ ] Invite client form validates email
- [ ] Invite creates auth user (check Supabase Auth)
- [ ] Invite email sent (check Resend logs)

---

## Running Tests

```bash
# Run all unit tests
npm run test

# Run with watch mode
npm run test:watch
```

Expected output:
```
✓ tests/unit/noticeParser.test.ts (5 tests)
✓ tests/unit/proposalGenerator.test.ts (5 tests)
✓ tests/unit/jobRouter.test.ts (4 tests)
✓ tests/unit/fortyEightHour.test.ts (4 tests)
```

---

## Production Deployment — Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Elev8 Comply"
git remote add origin https://github.com/YOUR_USERNAME/elev8-comply.git
git push -u origin main
```

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → select `elev8-comply`
3. Framework: **Next.js** (auto-detected)
4. Root directory: `.` (project root)
5. Click **Deploy**

### Step 3 — Add Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables, add ALL variables from `.env.example`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `DATABASE_URL` | Supabase → Settings → Database → Session Pooler URI |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Your verified Resend domain |
| `RESEND_FROM_NAME` | Elev8 Comply |
| `TWILIO_ACCOUNT_SID` | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | console.twilio.com |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number |
| `TWILIO_WEBHOOK_SECRET` | Random 32-char string |
| `EMAIL_INTAKE_WEBHOOK_SECRET` | Random 32-char string |
| `CRON_SECRET` | Random 32-char string |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g. https://elev8-comply.vercel.app) |
| `NEXT_PUBLIC_APP_NAME` | Elev8 Comply |

**Generate random secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4 — Update Supabase Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add `https://your-app.vercel.app/api/auth/callback`

### Step 5 — Configure Twilio Webhook

In Twilio Console → Phone Numbers → Your Number → Messaging:
- **A Message Comes In**: `https://your-app.vercel.app/api/webhooks/twilio`
- **Status Callback URL**: `https://your-app.vercel.app/api/webhooks/twilio`

### Step 6 — Configure Email Intake (Optional)

If using SendGrid Inbound Parse:
1. Set up email forwarding in SendGrid
2. Point webhook to: `https://your-app.vercel.app/api/webhooks/email-intake`
3. Add header: `x-webhook-secret: YOUR_EMAIL_INTAKE_WEBHOOK_SECRET`

### Step 7 — Verify Cron Job

The `vercel.json` configures a cron that runs every 30 minutes:
```json
{ "path": "/api/cron/48hour-sweep", "schedule": "*/30 * * * *" }
```

After deployment, check Vercel Dashboard → Deployments → Functions → Cron Jobs

---

## Post-Deployment Checklist

- [ ] Login works in production
- [ ] File upload goes to Supabase Storage (notices bucket)
- [ ] AI parsing returns results (check OpenAI billing)
- [ ] Proposal email arrives in inbox (check Resend logs)
- [ ] SMS test sent to real phone via Twilio
- [ ] Cron job appears in Vercel → Cron Jobs
- [ ] /api/cron/48hour-sweep returns 200 when called with CRON_SECRET
- [ ] Supabase RLS blocks cross-account data access

---

## Common Production Issues

| Problem | Fix |
|---|---|
| PDF upload fails | Check Supabase Storage bucket policies and RLS |
| AI parse times out | Next.js server action max duration is 30s — enable Edge Runtime or Vercel Pro for longer |
| Emails not arriving | Check Resend domain verification and DKIM/SPF records |
| SMS not sending | Verify Twilio number is active and FROM number matches registered number |
| Cron not firing | Cron requires Vercel Pro plan on production |
| DB connection fails | Use Session Pooler URL (port 5432) not Direct connection in production |
| IPv6 timeout | Switch DATABASE_URL to Session Pooler (`aws-0-xxx.pooler.supabase.com`) |

---

## Environment Setup Comparison

| Setting | Local Dev | Production |
|---|---|---|
| DATABASE_URL | Session Pooler or Direct | Session Pooler |
| NEXT_PUBLIC_APP_URL | http://localhost:3000 | https://your-app.vercel.app |
| Email sending | Resend (test mode OK) | Resend (verified domain required) |
| SMS sending | Twilio test credentials OK | Twilio live credentials |
| Cron | Manual: curl /api/cron/... | Vercel Cron (Pro plan) |
