/** Run from school-portal with --dry-run, --execute or --verify. Inputs and credentials stay in private-imports. */
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allocateEmployeeIds, matchStaff, staffRole, type StaffRosterEntry } from "../lib/staffAccountSetup";
import { studentLoginBase } from "../lib/studentLoginNames";
import { PORTAL_LOGIN_DOMAIN } from "../lib/portalLoginDomain";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const directory = path.resolve("private-imports");
const manifestPath = path.join(directory, "staff-account-handover-2026-2027.json");
const textPath = path.join(directory, "staff-login-details-2026-2027.txt");
const read = (file: string) => JSON.parse(readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, ""));
const digest = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const save = (file: string, data: unknown, exclusive = false) => writeFileSync(file, JSON.stringify(data, null, 2), { flag: exclusive ? "wx" : "w", mode: 0o600 });
const teachingRoles = new Set<Role>(["SUBJECT_TEACHER", "FORM_TEACHER", "PRINCIPAL", "NURSERY_HEAD", "PRIMARY_HEAD"]);

async function loadUsers(client: Prisma.TransactionClient = db) {
  return client.user.findMany({ where: { role: { not: "STUDENT" } }, orderBy: { id: "asc" }, include: {
    teacher: { include: { assignments: { orderBy: { id: "asc" } } } },
  } });
}

async function fingerprint(client: Prisma.TransactionClient = db) {
  const value: Record<string, unknown> = {};
  for (const table of ["results", "broad_sheets", "attendance", "result_comments", "students", "student_enrollments", "subject_assignments"]) {
    value[table] = await client.$queryRaw(Prisma.sql`
      SELECT count(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) AS fingerprint
      FROM ${Prisma.raw(`"${table}"`)} t`);
  }
  return value;
}

type Row = StaffRosterEntry & {
  userId: string | null; teacherId: string | null; employeeId: string | null; login: string; role: Role | null;
  requestedRole: Role | null; positionPending: boolean; formClassPending: boolean;
  formClassId: string | null; formClassLabel: string | null; newAccount: boolean; newTeacher: boolean;
  initialPassword: string | null; passwordHash: string | null; matchMethod: string;
};
type Manifest = { status: string; preparedAt: string; completedAt?: string; summary: Record<string, number>; rows: Row[]; historyBefore: unknown };

function writeHandover(manifest: Manifest) {
  const lines = ["CELIAS PORTAL — STAFF LOGIN DETAILS", "Session: 2026/2027", "",
    "Sign in: https://celias-portal-school-portal.vercel.app/auth/signin", "These login addresses are portal identifiers, not email inboxes.",
    "Change your password through Account security. Existing passwords have been preserved.",
    "Assistant-administrator and deputy privileges remain pending, as requested.", ""];
  for (const row of manifest.rows) {
    lines.push(`${row.sourceNumber}. ${row.fullName}`, `Position: ${row.position}`);
    if (row.userId) lines.push(`Login: ${row.login}`, `Initial password: ${row.initialPassword ?? "EXISTING PASSWORD (unchanged)"}`, `Portal role: ${row.role}`, `Employee ID: ${row.employeeId ?? "Not a teaching account"}`,
      `Form class: ${row.formClassLabel ?? (row.formClassPending ? "AWAITING CLASS — existing teaching access preserved" : "Not assigned")}`,
      `Status: ${row.positionPending ? "Deputy privileges pending; existing teacher access preserved" : row.formClassPending ? "Account ready; form-teacher class and role pending" : "READY"}`);
    else lines.push("Status: PENDING ROLE DECISION — account not created", `Proposed login: ${row.login}`);
    lines.push("");
  }
  writeFileSync(textPath, lines.join("\r\n"), { mode: 0o600 });
}

async function verify(manifest: Manifest, checkInitial = false) {
  const rows = manifest.rows.filter(row => row.userId);
  const users = await db.user.findMany({ where: { id: { in: rows.map(row => row.userId!) } }, include: { teacher: true } });
  if (users.length !== rows.length) throw new Error("Staff verification failed: missing accounts.");
  for (const row of rows) {
    const user = users.find(user => user.id === row.userId)!;
    if (user.email !== row.login || user.role !== row.role || !user.isActive || !user.passwordHash) throw new Error(`Staff account verification failed at roster row ${row.sourceNumber}.`);
    if (row.teacherId && (user.teacher?.id !== row.teacherId || user.teacher?.employeeId !== row.employeeId || user.teacher?.formClassId !== row.formClassId)) throw new Error(`Teaching profile verification failed at roster row ${row.sourceNumber}.`);
    if (checkInitial && row.newAccount && user.passwordHash !== row.passwordHash) throw new Error("Initial staff credential mismatch.");
  }
  console.log(JSON.stringify({ verifiedAccounts: users.length, ...manifest.summary }));
}

async function main() {
  if (existsSync(manifestPath)) {
    const saved: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (saved.status !== "COMPLETE" && !process.argv.includes("--verify")) throw new Error("Prepared handover exists. Inspect the backup and run --verify before retrying.");
    await verify(saved);
    saved.status = "COMPLETE"; saved.completedAt ??= new Date().toISOString(); save(manifestPath, saved); writeHandover(saved);
    return;
  }
  if (process.argv.includes("--verify")) throw new Error("No staff account handover exists.");
  const roster = read("staff-roster-2026-2027.json") as { staff: StaffRosterEntry[] };
  const decisions = read("reviewed-staff-matches.json") as {
    reviewedMatches: { sourceNumber: number; userId: string; reason: string }[];
    formClasses: Record<string, { name: string; arm: string; create: boolean }>;
  };
  const [users, sessions, classes, allLogins] = await Promise.all([
    loadUsers(), db.academicSession.findMany({ where: { name: "2026/2027", isCurrent: true } }),
    db.class.findMany({ orderBy: { id: "asc" } }), db.user.findMany({ select: { id: true, email: true } }),
  ]);
  if (sessions.length !== 1 || roster.staff.length !== 41) throw new Error("Expected one current 2026/2027 session and 41 staff rows.");
  const session = sessions[0];
  const matches = matchStaff(roster.staff, users, new Map(decisions.reviewedMatches.map(entry => [entry.sourceNumber, entry.userId])));
  const rows: Row[] = matches.map(staff => {
    const user = users.find(user => user.id === staff.userId);
    if (user && (!user.isActive || !user.passwordHash || user.role === "SUPER_ADMIN")) throw new Error(`Existing account needs manual review at roster row ${staff.sourceNumber}.`);
    const requestedRole = staffRole(staff.position, user?.role);
    const positionPending = requestedRole === null;
    const formClassPending = requestedRole === "FORM_TEACHER" && !decisions.formClasses[String(staff.sourceNumber)] && !user?.teacher?.formClassId;
    const role = positionPending || formClassPending ? user?.role ?? (formClassPending ? "SUBJECT_TEACHER" : null) : requestedRole;
    const userId = user?.id ?? (positionPending ? null : randomUUID());
    const needsTeacher = Boolean(role && teachingRoles.has(role));
    return { sourceNumber: staff.sourceNumber, fullName: staff.fullName, gender: staff.gender, position: staff.position, sourceEmail: staff.sourceEmail,
      userId, teacherId: user?.teacher?.id ?? (needsTeacher && userId ? randomUUID() : null), employeeId: user?.teacher?.employeeId ?? null,
      login: "", role, requestedRole, positionPending, formClassPending,
      formClassId: user?.teacher?.formClassId ?? null, formClassLabel: null,
      newAccount: Boolean(userId && !user), newTeacher: Boolean(userId && needsTeacher && !user?.teacher), initialPassword: null, passwordHash: null, matchMethod: staff.method };
  });
  const targetIds = new Set(rows.flatMap(row => row.userId ? [row.userId] : []));
  const occupied = new Set(allLogins.filter(user => !targetIds.has(user.id)).map(user => user.email.toLowerCase()));
  for (const row of rows) {
    const base = studentLoginBase(row.fullName); let suffix = 2; row.login = `${base}@${PORTAL_LOGIN_DOMAIN}`;
    while (occupied.has(row.login)) row.login = `${base}${suffix++}@${PORTAL_LOGIN_DOMAIN}`;
    occupied.add(row.login);
  }
  const employeeIds = allocateEmployeeIds(users.flatMap(user => user.teacher ? [user.teacher.employeeId] : []), rows.filter(row => row.newTeacher).length);
  let employeeIndex = 0;
  for (const row of rows) if (row.newTeacher) row.employeeId = employeeIds[employeeIndex++];
  const newClasses: Prisma.ClassCreateManyInput[] = [];
  for (const row of rows) {
    const definition = decisions.formClasses[String(row.sourceNumber)];
    if (definition && !row.positionPending) {
      const found = classes.filter(c => c.sessionId === session.id && c.name.toLowerCase() === definition.name.toLowerCase() && c.arm.toLowerCase() === definition.arm.toLowerCase());
      if (found.length > 1 || (!found.length && !definition.create)) throw new Error(`Form class needs review at roster row ${row.sourceNumber}.`);
      const id = found[0]?.id ?? randomUUID();
      if (!found.length) newClasses.push({ id, name: definition.name, arm: definition.arm, level: "secondary", capacity: 40, sessionId: session.id });
      const owner = users.find(user => user.teacher?.formClassId === id && user.id !== row.userId);
      if (owner) throw new Error(`Form class ${definition.name} ${definition.arm} already belongs to another teacher.`);
      row.formClassId = id; row.formClassLabel = `${definition.name} ${definition.arm}`;
    } else if (row.formClassId) {
      const found = classes.find(c => c.id === row.formClassId); row.formClassLabel = found ? `${found.name} ${found.arm}` : null;
    }
  }
  const summary = { rosterStaff: rows.length, readyRoles: rows.filter(row => row.userId && !row.positionPending && !row.formClassPending).length,
    newAccounts: rows.filter(row => row.newAccount).length, existingAccounts: rows.filter(row => row.userId && !row.newAccount).length,
    pendingPositions: rows.filter(row => row.positionPending).length, awaitingFormClasses: rows.filter(row => row.formClassPending).length,
    newTeacherProfiles: rows.filter(row => row.newTeacher).length, newClasses: newClasses.length };
  save(path.join(directory, "staff-account-plan-2026-2027.json"), { summary, rows, newClasses });
  console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "execute" : "dry-run", ...summary }));
  if (!process.argv.includes("--execute")) return;
  for (const row of rows.filter(row => row.newAccount)) { row.initialPassword = `C!${randomBytes(12).toString("base64url")}7aA`; row.passwordHash = await bcrypt.hash(row.initialPassword, 12); }
  const beforeFingerprint = await fingerprint();
  const manifest: Manifest = { status: "PREPARED", preparedAt: new Date().toISOString(), summary, rows, historyBefore: beforeFingerprint };
  save(path.join(directory, `staff-account-backup-${Date.now()}.json`), { users, classes, session, fingerprints: beforeFingerprint }, true);
  save(manifestPath, manifest, true);
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('Staff roster setup 2026/2027'))`;
    if (digest(await loadUsers(tx)) !== digest(users)) throw new Error("Staff records changed after planning; transaction aborted.");
    if (newClasses.length) await tx.class.createMany({ data: newClasses });
    const newUsers = rows.filter(row => row.newAccount);
    if (newUsers.length) await tx.user.createMany({ data: newUsers.map(row => ({ id: row.userId!, name: row.fullName, email: row.login, passwordHash: row.passwordHash!, role: row.role!, isActive: true })) });
    for (const row of rows.filter(row => row.userId)) {
      if (!row.newAccount) await tx.user.update({ where: { id: row.userId! }, data: { name: row.fullName, email: row.login, role: row.role! } });
      if (row.newTeacher) await tx.teacher.create({ data: { id: row.teacherId!, userId: row.userId!, employeeId: row.employeeId!, formClassId: row.formClassId } });
      else if (row.teacherId) {
        const before = users.find(user => user.id === row.userId)!.teacher!;
        if (before.formClassId !== row.formClassId) await tx.teacher.update({ where: { id: row.teacherId }, data: { formClassId: row.formClassId } });
      }
    }
    await tx.auditLog.createMany({ data: rows.filter(row => row.userId).map(row => ({ userId: row.userId!, action: row.newAccount ? "CREATE" as const : "UPDATE" as const, entity: "User", entityId: row.userId!, description: `Staff roster account setup; row ${row.sourceNumber}; ${row.role}; ${row.positionPending ? "deputy privileges pending" : row.formClassPending ? "form class pending" : "position applied"}` })) });
    const after = await loadUsers(tx);
    for (const user of users) if (after.find(current => current.id === user.id)?.passwordHash !== user.passwordHash) throw new Error("Existing staff password changed; transaction aborted.");
    if (digest(await fingerprint(tx)) !== digest(beforeFingerprint)) throw new Error("Academic records or subject assignments changed; transaction aborted.");
  }, { timeout: 180_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await verify(manifest, true);
  manifest.status = "COMPLETE"; manifest.completedAt = new Date().toISOString(); save(manifestPath, manifest); writeHandover(manifest);
  console.log("Staff setup complete. Private login handover saved; existing passwords and academic records preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
