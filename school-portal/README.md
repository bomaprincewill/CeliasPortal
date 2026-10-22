# School Portal

School management system built with Next.js 16, React 19, Prisma, PostgreSQL, NextAuth, and Tailwind CSS.

It provides role-based portals for administrators, finance staff, teachers, students, parents, and applicants, including admissions, CBT exams, attendance, results, report cards, and fee receipts.

## Quick start

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Environment

Configure these variables in `.env`:

- `DATABASE_URL`: pooled PostgreSQL connection for application runtime.
- `DIRECT_URL`: direct PostgreSQL connection for Prisma migrations.
- `NEXTAUTH_SECRET`: a unique secret of at least 32 characters.
- `NEXTAUTH_URL`: the deployment URL, or `http://localhost:3000` locally.
- `SEED_DEFAULT_PASSWORD`: a unique 12+ character password for development seed accounts.

Optional email delivery uses `RESEND_API_KEY` and `EMAIL_FROM`, or the SMTP variables in `.env.example`.

## Commands

Run these commands from the workspace root:

```powershell
npm run dev
npm run test
npm run lint
npm run build
npm run db:deploy
npm run db:seed
```

## Production checklist

See [LAUNCH_READINESS.md](LAUNCH_READINESS.md) for the verified deployment,
remaining school-data requirements, and the email DNS handover.

Run `npm run launch:check` from the workspace root for read-only production
configuration and database checks. Use `npm run launch:check -- --data-only`
when checking the configured database from a local development environment.

## Student roster accounts

The 2026/2027 pupil roster and reviewed identity matches are stored locally in
`private-imports/`, which is excluded from Git. From `school-portal`, run:

```powershell
node --import tsx scripts/setup-roster-accounts.ts --dry-run
node --import tsx scripts/setup-roster-accounts.ts --execute
node --import tsx scripts/setup-roster-accounts.ts --verify
```

The setup retains admission numbers for matched result records, allocates new
`CIS2026/NNNN` numbers for new pupils, and applies the roster's current class
placements. Historical results and enrollments are preserved. New accounts get
unique passwords; existing passwords remain unchanged. The private handover is
`private-imports/student-login-details-2026-2027.txt`. Students can change their
password through **Account security**. Once a completed handover exists, rerunning
the script verifies those accounts instead of creating duplicates or resetting
passwords.

Roster login names use `first.last@celias-portal`, with a numeric suffix only
when needed to keep names unique. These are portal login identifiers. To preview
or apply the same format to an existing private handover, run
`node --import tsx scripts/shorten-student-logins.ts --dry-run` or
`node --import tsx scripts/shorten-student-logins.ts --execute`. This updates the
configured database and preserves passwords. Run the roster setup command with
`--verify` afterward to refresh the private text handover.

## Production configuration

- Set production database and authentication variables in the hosting provider.
- Apply migrations with `npm run db:deploy`; do not use `db:push` in production.
- Configure a verified transactional email domain before sending password or applicant setup links.
- Remove demonstration data and never use the development seed password in production.
- Monitor the public `/api/health` and `/api/health/ready` endpoints from your hosting platform.

## Completed session rollover

The 2025/2026 cohort was advanced one grade into 2026/2027, retaining class
arms. SS 3 students were marked graduated. Historical results and reports
remain in their original session. Families use the student's login to view
results; separate parent accounts and family links are optional.

From the `school-portal` directory, preview the fixed-session rollover:

```powershell
node --import tsx scripts/promote-session.ts --final-year=graduate
```

Adding `--execute` applies pending changes in one database transaction after
saving a private rollback snapshot under `private-imports/session-rollovers`.
The script validates existing destination enrollments to prevent a repeated
run from advancing students twice, checks capacity, and verifies that
historical result and report records remain unchanged. It is specific to
these two sessions; review the mapping before adapting it for another year.
