# SchoolPortal — Complete School Management System

> Full-stack Next.js 14 · Prisma · PostgreSQL · NextAuth.js · Tailwind CSS
> **65 files · 5 user roles · 100% complete**

## Quick Start

```bash
cd school-portal
npm install
Copy-Item .env.example .env
# Add your Supabase pooler URLs, NEXTAUTH_SECRET, and a unique
# SEED_DEFAULT_PASSWORD (12+ characters) to .env
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Development seed

The seed creates local test accounts using `SEED_DEFAULT_PASSWORD`. Never run the
demonstration seed in production, publish that password, or reuse it elsewhere.

## All 65 Files Delivered

### Foundation
- schema.prisma — 16 Prisma models (full ecosystem)
- middleware.ts — JWT RBAC + dynamic ownership checks
- lib/auth.ts — NextAuth + extended JWT
- lib/audit.ts — Audit log helper
- lib/prisma.ts, lib/utils.ts, types/index.ts

### Server Actions (5 files)
- actions/results/compileResults.ts — Ranking engine + lock/unlock
- actions/results/saveScores.ts — Draft score upsert with validation
- actions/results/uploadScores.ts — Bulk CSV parser + upsert
- actions/cbt/submitExam.ts — CBT grading engine (MCQ/TF/keyword/manual)
- actions/notifications/index.ts — Notification CRUD

### Components (9 files)
- ResultInputGrid.tsx — Excel-style score entry (keyboard nav, paste, live total)
- BroadSheet.tsx — Sortable class performance table with print
- ReportCard.tsx — Printable HTML report card
- ScoreUploader.tsx — CSV drag-drop bulk upload with preview
- AttendanceGrid.tsx — Daily attendance register with mark-all
- ExamRunner.tsx — Timed CBT (all 4 types, auto-submit)
- Sidebar.tsx — Role-aware navigation
- DashboardShell.tsx, Providers.tsx

### Pages (30+ files across 5 portals)
- Admin: dashboard, users, classes, subjects, results, compile, audit, settings
- Teacher: dashboard, results list, score entry, attendance, broadsheet
- Parent: dashboard, report card (per term, printable)
- Applicant: register (3-step), dashboard, entrance exam
- Shared: signin, reset-password, notifications

### API Routes
- /api/auth/[...nextauth] — NextAuth handler
- /api/cbt/exam/[examId] — Secure exam loader (strips answers, shuffles)
- /api/report/[studentId] — Printable HTML report generator

## Result Lifecycle

DRAFT → SUBMITTED → APPROVED → LOCKED → BroadSheet computed

## Deployment

```bash
# Vercel
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL   # https://yourschool.com
vercel deploy
npm run db:deploy
```

## Database workflow

- `DATABASE_URL` is the pooled runtime connection (Supabase port 6543). A small
  Prisma pool such as `connection_limit=5&pool_timeout=30` supports pages that
  issue several queries in parallel without exhausting Supabase connections.
- `DIRECT_URL` is the session connection used by Prisma migrations (Supabase port 5432).
- Create a migration after changing `schema.prisma` with `npm run db:migrate -- --name describe_change`.
- Apply committed migrations in production with `npm run db:deploy`.
- Check migration state with `npm run db:status`.

Never use `db:push` for production schema changes; migrations provide a reviewable,
repeatable history.
