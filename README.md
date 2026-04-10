# Elev8 Comply

Elevator repair and compliance management system.

---

## Quick Start

Open the project in VS Code, open the terminal (`Ctrl+` ` `), then:

```
node scripts/setup.js
```

---

## Manual Setup (if the script fails)

```powershell
npm cache clean --force
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
npm install autoprefixer next-themes
npx shadcn@latest init
```
When prompted: **Default** → **Slate** → **Yes**

```powershell
npx shadcn@latest add button card badge dialog form input label select textarea toast toaster separator avatar tabs checkbox popover alert-dialog scroll-area switch progress table skeleton dropdown-menu sonner
```

---

## Environment Setup

Copy and fill in `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

**Required variables:**

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `DATABASE_URL` | Supabase → Settings → Database → **Session Pooler** URI |
| `DIRECT_DATABASE_URL` | Supabase → Settings → Database → **Direct** connection URI |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Your verified Resend sender |
| `TWILIO_ACCOUNT_SID` | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | console.twilio.com |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number |

**Important:** Use the **Session Pooler** URL for `DATABASE_URL` (port 5432, hostname `aws-0-xxx.pooler.supabase.com`). This fixes IPv6 timeout errors on Windows.

---

## Database Setup

In **Supabase Dashboard → SQL Editor**, run in order:

1. `supabase/migrations/00_extensions.sql`
2. `drizzle/migrations/0000_initial.sql`
3. `supabase/migrations/01_rls_policies.sql`
4. `supabase/migrations/02_storage_policies.sql`

---

## Storage Buckets

Create in **Supabase → Storage → New bucket**:

| Name | Public |
|---|---|
| `notices` | No |
| `attachments` | No |
| `completion-photos` | No |

---

## Run

```powershell
npm run dev
```

Open http://localhost:3000

---

## Seed Test Data

Two options:

**Option A — SQL (recommended):**
In Supabase SQL Editor, first create these 7 auth users (Authentication → Users → Add User):

| Email | Password |
|---|---|
| admin@elev8comply.com | Admin1234! |
| reviewer@elev8comply.com | Review1234! |
| dispatcher@elev8comply.com | Dispatch1234! |
| tech1@elev8comply.com | Tech1234! |
| tech2@elev8comply.com | Tech1234! |
| client@westsideproperties.com | Client1234! |
| client@harborview.com | Client1234! |

Then run `drizzle/seed/seed.sql` in SQL Editor.

**Option B — Node seed script:**
```powershell
node scripts/seed-runner.js
```

---

## Test Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@elev8comply.com | Admin1234! |
| Reviewer | reviewer@elev8comply.com | Review1234! |
| Dispatcher | dispatcher@elev8comply.com | Dispatch1234! |
| Technician | tech1@elev8comply.com | Tech1234! |
| Client | client@westsideproperties.com | Client1234! |

---

## Build Phases

| Phase | Status | Contents |
|---|---|---|
| 1 | ✅ | Architecture, folder structure |
| 2 | ✅ | Database schema, RLS, SQL migrations |
| 3 | ✅ | Config, env, auth, Supabase clients |
| 4 | ✅ | UI layouts, auth pages, dashboards |
| 5 | ✅ | Notice intake, PDF upload, AI parsing, job creation |
| 6 | ✅ | Proposals: AI draft, send, approve, revisions |
| 7 | ✅ | Client portal, scheduling request/confirm |
| 8 | ✅ | Dispatch, work orders, technician workflow |
| 9 | ✅ | Email templates, SMS notifications, 48-hr alerts |
| 10 | ✅ | Seed data, QA checklist, deployment guide |

---

## Tech Stack

- **Framework**: Next.js 15 (App Router + Server Actions)
- **Database**: Supabase Postgres + Drizzle ORM
- **Auth**: Supabase Auth
- **AI**: OpenAI GPT-4o
- **Email**: Resend + React Email
- **SMS**: Twilio
- **UI**: Tailwind CSS + shadcn/ui
- **Validation**: Zod + React Hook Form
- **Testing**: Vitest

## Deployment

See `docs/QA_AND_DEPLOYMENT.md` for the full QA checklist and Vercel deployment guide.
