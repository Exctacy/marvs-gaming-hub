# MARVS Gaming Hub — Staff Operations Portal

Production-ready multi-branch Gaming Hub Management System for **MARVS Gaming Hub**.

Desktop-first staff portal for daily shift reporting, equipment tracking, and hub oversight.  
**Operations-only** — no customer loyalty, points, top-ups, or rewards.

## Features

- **Multi-branch** with strict role-based access (RLS-style enforcement at API)
- **Roles**: `super_admin`, `admin`, `management`, `counter_admin`, `computer_tech`, `team_leader`
- **Branch locking**: counter/tech/team_leader/admin locked to home branch
- **Branch switching**: only super_admin & management
- **Custom auth**: PBKDF2/SHA-256 + per-record salt, JWT session cookies
- **Must-change-password** on first login
- **Atomic append-only audit log** for every sensitive action
- **Shift reports**: Opening / Mid / Night with PC checklists, games, defects + brands, spares, signatures (PNG data URLs), draft/submit
- **Hub Overview** aggregates + recurring defect detection
- **Client-side PDF** (jsPDF) for reports & overview
- **Modern navy/blue gaming theme**, shadcn-style UI, Lucide icons, responsive sidebar + mobile sheet

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Prisma + PostgreSQL (production-ready for Vercel)
- Tailwind CSS + Radix UI primitives
- jose (JWT), bcryptjs-style PBKDF2 via Node crypto
- jsPDF + jspdf-autotable
- sonner toasts

## Quick Start

```bash
cd marvs-hub   # or marvs-gaming-hub

# Install
npm install

# Environment
cp .env.example .env
# Set JWT_SECRET to at least 32 random characters for production

# Database
npx prisma generate
npx prisma db push
npm run db:seed

# Dev
npm run dev
```

Open http://localhost:3000

### Seed Accounts

| Username     | Password     | Role            | Notes                          |
|--------------|--------------|-----------------|--------------------------------|
| superadmin   | Admin@123!   | super_admin     | Global, can switch branches    |
| main.admin   | Admin@123!   | admin           | Locked to MAIN branch          |
| counter1     | TempPass1!   | counter_admin   | Must change password on login  |
| tech1        | Tech@123!    | computer_tech   | Locked to MAIN                 |

## Project Structure

```
src/
  app/
    (auth)/login/          Split-screen login
    (portal)/              Authenticated shell + pages
      dashboard/
      reports/             List, new, [id] detail
      config/              Gaming hub config
      hub-overview/
      staff/
      branches/
      audit/
      settings/
      guide/
      change-password/
    change-password/       Forced first-login change
    api/                   REST endpoints (auth, reports, staff, …)
  components/
    ui/                    Button, Input, Card, …
    layout/                Sidebar, PortalShell
  lib/
    auth.ts                Sessions, roles, branch resolution
    password.ts            PBKDF2
    prisma.ts
    audit.ts
    utils.ts
prisma/
  schema.prisma
  seed.ts
```

## Role Matrix (summary)

| Capability              | super_admin | admin | management | counter/tech/tl |
|-------------------------|-------------|-------|------------|-----------------|
| Switch branch           | ✓           | —     | ✓          | — (locked)      |
| Create/edit own drafts  | ✓           | ✓     | ✓          | ✓               |
| Delete any report       | ✓           | ✓     | ✓          | own drafts only |
| Staff management        | global      | own branch | global  | —               |
| Branch management       | ✓           | —     | —          | —               |
| Config write            | ✓           | ✓     | ✓          | —               |
| PDF export              | ✓           | ✓     | ✓          | view-only       |

## Production Notes

1. Change `JWT_SECRET` and use a strong random value.
2. Use a managed Postgres database on Vercel (for example, Vercel Postgres/Neon).
3. Run behind HTTPS; cookies are `httpOnly` + `secure` in production.
4. Add rate-limiting on `/api/auth/login`.
5. Consider Redis/session store for horizontal scaling (current: DB-backed sessions).
6. Back up your Postgres database and enable monitoring.

## IR & Memos

The `/documents` module supports multi-participant Incident Reports and equipment
acknowledgment memos based on the supplied paper templates. It recreates their
fields and sections in web forms and a paginated PDF; it does not overlay the
original PDF artwork.

- Team Leaders and Management initiate documents for up to 50 active staff in the selected branch.
- Branch admins review their branch; Management and Super Admin can review across branches.
- TL initiators need an independent approver. Management initiators issue directly with one "Initiated and approved by" signature. Participants cannot approve a TL-initiated document.
- Staff see only their issued documents under My documents, regardless of later branch transfer.
- Preparation, approval, and staff signatures are bound to the stored content version and SHA-256 fingerprint.
- Submitted/issued content is locked; returned drafts need a saved new version, and issued corrections create linked revisions with fresh signatures.
- Each IR participant writes their own explanation and signs it; initiators cannot provide explanations for staff. Memo participants acknowledge separately. Declining requires a reason and does not block other participants.
- Document history, audit entries, notices, and state transitions commit in one transaction. Optimistic locking rejects stale actions.
- Notices are private, in-app only. The sidebar refreshes its unread badge every minute; there is no email or SMS delivery.

Database setup for an existing installation is documented in
[`prisma/updates/README.md`](prisma/updates/README.md). Run `npm run test:documents`
for policy and API workflow tests. API tests use an in-memory transaction double;
they do not replace validation against a running PostgreSQL instance.

Saved documents offer an exact inline PDF preview; unsaved drafts have a form preview. Apply the October 21 participant update before deploying this version (see the database setup link above).

### Manual verification

1. Log in as a TL, select an IR or Memo, select one or more active staff members, and save a draft.
2. Review and sign as preparer; verify the staff account cannot access the pending draft.
3. As an independent branch manager, return with a reason or approve and sign.
4. As each participant, open My documents, add your own IR explanation, and sign or decline with a reason. The document stays open until all participants respond.
5. Verify other staff/branch admins cannot access the document or its PDF.
6. Preview the saved PDF inline and download/print it. Check long explanations, every staff signature, and the combined management signature. History remains in the portal.
7. Create a correction; verify original signatures remain on the original and the new draft has none.

## License

Proprietary — MARVS Gaming Hub internal use.
