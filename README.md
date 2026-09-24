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

## License

Proprietary — MARVS Gaming Hub internal use.
