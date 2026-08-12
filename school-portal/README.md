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

- Set production database and authentication variables in the hosting provider.
- Apply migrations with `npm run db:deploy`; do not use `db:push` in production.
- Configure a verified transactional email domain before sending password or applicant setup links.
- Remove demonstration data and never use the development seed password in production.
- Monitor the public `/api/health` and `/api/health/ready` endpoints from your hosting platform.
