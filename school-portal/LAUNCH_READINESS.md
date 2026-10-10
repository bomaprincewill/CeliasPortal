# School portal launch handover

Review date: 10 October 2026 (Africa/Lagos).
Production site: https://celias-portal-school-portal.vercel.app
Vercel project: `celias-portal-school-portal`.

## Verified

- Production login URL and server action origin match the free Vercel domain.
- Production demo quick-login is disabled.
- All 12 anonymous site checks pass: sign-in, password reset page, health,
  database readiness, role portals, finance API, and CBT API protection.
- The configured database is reachable and has every repository migration.
- Academic session `2026/2027` is current; school settings exist.
- There are 35 active teacher profiles and 250 active teacher/subject/class
  assignments in `2026/2027`.
- The database contains 9,222 result records. Source-to-report acceptance
  checks remain necessary; record counts alone do not establish accuracy.

## Code prepared for release

- Password changes, admin resets, and setup links invalidate older sessions
  through a private credential tag. No database migration is required.
- Existing sessions created before this change must sign in again.
- Sign-in stays accessible with an old cookie, preventing redirect loops.
- The account security screen signs out after a successful password change.
- `npm run launch:check` validates configuration and inspects school data
  without changing records. Use `-- --data-only` when inspecting local data
  with a development login URL.
- `node school-portal/scripts/check-site.mjs https://celias-portal-school-portal.vercel.app`
  checks the public deployment without logging in or writing data.
- An hourly GitHub Actions health workflow checks the public site. GitHub
  workflow notification settings determine who receives failure alerts.

## Items that need school information or external access

1. **Email DNS:** `celiasschools.org` has failed Resend verification. Its DNS
   is managed through Cloudoon, outside the connected Vercel account. Give
   [EMAIL_DNS_SETUP.md](EMAIL_DNS_SETUP.md) to its DNS administrator, verify
   the records in Resend, and test delivery to an approved recipient.
2. **Production administrator:** there are no active non-demo Super Admin
   accounts. Migrate `admin@school.edu` to the approved administrator's real
   email and use a fresh one-time password setup link. Preserve access until
   the new owner has successfully logged in.
3. **Demo accounts:** four seed accounts remain active. Review and disable
   them after the real administrator has access; preserve school records
   rather than running destructive demo cleanup scripts.
4. **Student access:** 175 of 227 eligible active students lack usable login
   accounts. Supply approved student login emails. In Admin → Users, bulk
   upload accounts using Name, Email, Password, Role=STUDENT, and Student ID
   matching the existing student record. Nursery pupils use parent access.
5. **Parent access:** all 227 active students lack usable parent links. Create
   approved parent accounts and use Admin → Family Links to connect each
   parent to the correct children. Never infer these relationships from names.
6. **Enrollment:** there are zero active enrollments in `2026/2027`. Confirm
   promotions/admissions in Admin → Enrollments. Imported historical records
   do not establish current enrollment.
7. **Backups:** confirm production database backup availability and perform
   a restore exercise in an isolated database before broad rollout. Backup
   and restore status have not been verified through the available access.

## Acceptance checks after account and data setup

Use approved test accounts for each role. Check teacher score submission →
approval → compilation → student/parent report and print; attendance;
receipt creation → paid receipt → balance; applicant approval → password
setup → CBT → grading → enrollment. Check that each account cannot read or
edit unrelated pupils/classes. Repeat key screens on mobile.

Email verification, backups, and authenticated acceptance testing are separate
from a successful build and the automated public health checks.
