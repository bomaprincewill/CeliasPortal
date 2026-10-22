/**
 * Run from school-portal after preparing the private roster and reviewed matches.
 * --dry-run writes a private plan; --execute creates accounts and enrollments.
 * --verify checks the saved handover without resetting passwords. No emails sent.
 */
import { loadEnvConfig } from "@next/env";
import { Gender, Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { allocateAdmissionNumbers, matchRoster, pupilName, rosterClass, type RosterPupil } from "../lib/studentAccountMatching";
import { buildStudentLogins, studentLoginBase } from "../lib/studentLoginNames";
import { PORTAL_LOGIN_DOMAIN } from "../lib/portalLoginDomain";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const directory = path.resolve("private-imports");
const manifestPath = path.join(directory, "student-account-handover-2026-2027.json");
const credentialsPath = path.join(directory, "student-login-details-2026-2027.txt");
const reason = "Pupil roster account setup 2026/2027";
const readJson = (file: string) => JSON.parse(readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, ""));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const save = (file: string, value: unknown, exclusive = false) => writeFileSync(file, JSON.stringify(value, null, 2), { flag: exclusive ? "wx" : "w", mode: 0o600 });

async function loadStudents(client: Prisma.TransactionClient) {
  return client.student.findMany({ orderBy: { id: "asc" }, include: {
    user: { select: { id: true, email: true, role: true, isActive: true, passwordHash: true } },
    enrollments: { orderBy: { id: "asc" } }, _count: { select: { results: true } },
  } });
}
type Student = Awaited<ReturnType<typeof loadStudents>>[number];

async function historyFingerprint(client: Prisma.TransactionClient) {
  const fingerprints: Record<string, unknown> = {};
  for (const table of ["results", "broad_sheets", "attendance", "result_comments"]) {
    fingerprints[table] = await client.$queryRaw(Prisma.sql`
      SELECT count(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) AS fingerprint
      FROM ${Prisma.raw(`"${table}"`)} t`);
  }
  return fingerprints;
}

type HandoverRow = {
  fullName: string; sourceClass: string; sourceNumber: number; gender: Gender;
  studentId: string; admissionNumber: string; classId: string; className: string; classArm: string;
  userId: string; login: string; initialPassword: string | null; passwordHash: string | null;
  newStudent: boolean; newAccount: boolean; matchMethod: string; matchReason: string; previousName: string | null;
};
type Handover = {
  status: string; preparedAt: string; completedAt?: string; sessionId: string; sessionName: string;
  historyBefore: unknown; summary: Record<string, number>; rows: HandoverRow[];
};

async function verify(handover: Handover, checkInitialHashes = false) {
  const students = await db.student.findMany({ where: { id: { in: handover.rows.map(row => row.studentId) } }, include: {
    user: true, class: true, enrollments: { where: { sessionId: handover.sessionId } }, _count: { select: { results: true } },
  } });
  if (students.length !== handover.rows.length) throw new Error("Verification failed: missing student profiles.");
  for (const row of handover.rows) {
    const student = students.find(s => s.id === row.studentId)!;
    if (student.studentId !== row.admissionNumber || student.userId !== row.userId || student.classId !== row.classId ||
        student.user?.role !== "STUDENT" || !student.user.isActive || student.user.email !== row.login || !student.user.passwordHash ||
        student.enrollments.length !== 1 || student.enrollments[0].classId !== row.classId || student.enrollments[0].status !== "ACTIVE") {
      throw new Error(`Verification failed for ${row.admissionNumber}.`);
    }
    if (checkInitialHashes && row.newAccount && student.user.passwordHash !== row.passwordHash) throw new Error(`Initial credential mismatch for ${row.admissionNumber}.`);
    if (row.newStudent && student._count.results !== 0) throw new Error(`Unexpected results for newly created pupil ${row.admissionNumber}.`);
  }
  if (checkInitialHashes && digest(await historyFingerprint(db)) !== digest(handover.historyBefore)) throw new Error("Historical data changed during account setup; inspect the snapshot.");
  console.log(JSON.stringify({ verifiedStudents: students.length, accountsLinked: students.filter(s => s.user).length, summary: handover.summary }));
}

function writeCredentials(handover: Handover) {
  const lines = ["CELIA'S INTERNATIONAL SCHOOL — STUDENT LOGIN DETAILS", `Session: ${handover.sessionName}`, "",
    "Sign in at the portal's /auth/signin page using the login email below.",
    "These login addresses are portal identifiers, not email inboxes.",
    "To change a password: sign in, open Account security, then enter the current and new passwords.",
    "Existing account passwords have been preserved. Where indicated, use the pupil's existing password.", ""];
  for (const row of handover.rows) lines.push(`${row.sourceClass} — ${row.sourceNumber}. ${row.fullName}`,
    `Admission number: ${row.admissionNumber}`, `Login email: ${row.login}`,
    `Initial password: ${row.initialPassword ?? "EXISTING PASSWORD (unchanged)"}`,
    `Account: ${row.newAccount ? "Created" : "Existing"}; pupil record: ${row.newStudent ? "New, awaiting results" : "Matched to imported results"}`, "");
  writeFileSync(credentialsPath, lines.join("\r\n"), { mode: 0o600 });
}

async function main() {
  mkdirSync(directory, { recursive: true });
  if (existsSync(manifestPath)) {
    const previous: Handover = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (process.argv.includes("--verify") || previous.status === "COMPLETE") {
      await verify(previous);
      if (previous.status !== "COMPLETE") { previous.status = "COMPLETE"; previous.completedAt = new Date().toISOString(); save(manifestPath, previous); }
      writeCredentials(previous);
      console.log("Saved accounts verified; passwords were not reset.");
      return;
    }
    throw new Error("A prepared handover already exists. Run --verify and inspect the snapshot before retrying; do not generate replacement passwords blindly.");
  }
  if (process.argv.includes("--verify")) throw new Error("No saved account handover exists.");
  const roster = readJson("student-roster-2026-2027.json") as { academicSession: string; students: RosterPupil[] };
  const reviewed = readJson("reviewed-student-matches.json") as { yearOneClass: string; matches: { fullName: string; admissionNumber: string; reason: string }[] };
  if (roster.academicSession !== "2026/2027" || reviewed.yearOneClass !== "Year 1") throw new Error("Review the session and confirmed Year 1 mapping.");
  const pupils = roster.students;
  if (!pupils.length || new Set(pupils.map(p => p.fullName)).size !== pupils.length || pupils.some(p => !["MALE", "FEMALE"].includes(p.gender))) throw new Error("Roster names or genders need review.");
  const [students, sessions, classes] = await Promise.all([
    loadStudents(db), db.academicSession.findMany({ where: { name: roster.academicSession } }), db.class.findMany({ orderBy: { id: "asc" } }),
  ]);
  if (sessions.length !== 1 || !sessions[0].isCurrent) throw new Error("Expected exactly one current destination session.");
  const session = sessions[0];
  const matched = matchRoster(pupils, students);
  const decisions = new Map(reviewed.matches.map(entry => [entry.fullName, entry]));
  for (const decision of reviewed.matches) if (!pupils.some(p => p.fullName === decision.fullName)) throw new Error(`Reviewed name missing from roster: ${decision.fullName}`);
  for (const entry of matched) {
    const decision = decisions.get(entry.fullName);
    if (!decision) continue;
    const student = students.find(s => s.studentId === decision.admissionNumber);
    if (!student || !student.isActive || student.status !== "ACTIVE" || !student._count.results) throw new Error(`Invalid reviewed match: ${decision.fullName}`);
    if (entry.matchedId && entry.matchedId !== student.id) throw new Error(`Reviewed match conflicts with automatic match: ${decision.fullName}`);
    entry.matchedId = student.id; entry.method = "REVIEWED"; entry.reason = "MATCHED";
  }
  const matchedIds = matched.flatMap(p => p.matchedId ? [p.matchedId] : []);
  if (new Set(matchedIds).size !== matchedIds.length || matched.some(p => ["AMBIGUOUS", "ROSTER_COLLISION"].includes(p.reason))) throw new Error("Resolve ambiguous or duplicate identities before creating pupils.");
  const newAdmissions = allocateAdmissionNumbers(students.map(s => s.studentId), matched.filter(p => !p.matchedId).length, 2026);
  const classPlans = new Map<string, { id: string; name: string; arm: string; level: string; capacity: number; newClass: boolean }>();
  for (const pupil of pupils) {
    if (classPlans.has(pupil.sourceClass)) continue;
    const definition = rosterClass(pupil.sourceClass);
    const found = classes.filter(c => c.sessionId === session.id && c.name.toLowerCase() === definition.name.toLowerCase() && c.arm.toLowerCase() === definition.arm.toLowerCase());
    if (found.length > 1) throw new Error(`Ambiguous class: ${pupil.sourceClass}`);
    classPlans.set(pupil.sourceClass, { ...definition, id: found[0]?.id ?? randomUUID(), capacity: found[0]?.capacity ?? 40, newClass: !found.length });
  }
  let admissionIndex = 0;
  const rows: HandoverRow[] = matched.map(pupil => {
    const existing = students.find(s => s.id === pupil.matchedId);
    if (existing?.user && (existing.user.role !== "STUDENT" || !existing.user.isActive || !existing.user.passwordHash)) throw new Error(`Existing account needs review: ${existing.studentId}`);
    const admissionNumber = existing?.studentId ?? newAdmissions[admissionIndex++];
    const schoolClass = classPlans.get(pupil.sourceClass)!;
    return { fullName: pupil.fullName, sourceClass: pupil.sourceClass, sourceNumber: pupil.sourceNumber, gender: pupil.gender as Gender,
      studentId: existing?.id ?? randomUUID(), admissionNumber, classId: schoolClass.id, className: schoolClass.name, classArm: schoolClass.arm,
      userId: existing?.userId ?? randomUUID(), login: existing?.user?.email ?? `${studentLoginBase(pupil.fullName)}@${PORTAL_LOGIN_DOMAIN}`,
      initialPassword: null, passwordHash: null, newStudent: !existing, newAccount: !existing?.userId,
      matchMethod: existing ? pupil.method : "NEW_ADMISSION", matchReason: decisions.get(pupil.fullName)?.reason ?? (existing ? pupil.method : "No confirmed existing pupil; new admission authorized by user"),
      previousName: existing ? pupilName(existing) : null };
  });
  const occupied = new Map<string, number>();
  const movedIds = new Set(rows.map(r => r.studentId));
  for (const student of students) if (!movedIds.has(student.id) && student.classId && student.isActive && student.status === "ACTIVE") occupied.set(student.classId, (occupied.get(student.classId) ?? 0) + 1);
  for (const row of rows) occupied.set(row.classId, (occupied.get(row.classId) ?? 0) + 1);
  for (const item of classPlans.values()) if ((occupied.get(item.id) ?? 0) > item.capacity) throw new Error(`Class capacity exceeded: ${item.name} ${item.arm}`);
  const reservedLogins = await db.user.findMany({ select: { email: true } });
  const generatedLogins = buildStudentLogins(rows.filter(row => row.newAccount), reservedLogins.map(user => user.email));
  for (const row of rows) if (row.newAccount) row.login = generatedLogins.get(row.userId)!;
  const logins = rows.filter(r => r.newAccount).map(r => r.login);
  if (new Set(logins).size !== logins.length || await db.user.count({ where: { email: { in: logins } } })) throw new Error("A proposed login email is already in use.");
  const summary = { rosterPupils: rows.length, matchedPupils: rows.filter(r => !r.newStudent).length, newPupils: rows.filter(r => r.newStudent).length,
    newAccounts: rows.filter(r => r.newAccount).length, existingAccounts: rows.filter(r => !r.newAccount).length, newClasses: [...classPlans.values()].filter(c => c.newClass).length,
    changedPlacements: rows.filter(r => !r.newStudent && students.find(s => s.id === r.studentId)!.classId !== r.classId).length };
  save(path.join(directory, "student-account-plan.json"), { session: session.name, summary, classes: [...classPlans.values()], rows });
  console.log(JSON.stringify({ mode: process.argv.includes("--execute") ? "execute" : "dry-run", ...summary, newAdmissionRange: [newAdmissions[0], newAdmissions.at(-1)] }));
  if (!process.argv.includes("--execute")) return;

  console.log("Preparing unique passwords and private handover before database changes...");
  for (const [index, row] of rows.filter(r => r.newAccount).entries()) {
    row.initialPassword = `C!${randomBytes(12).toString("base64url")}7aA`;
    row.passwordHash = await bcrypt.hash(row.initialPassword, 12);
    if ((index + 1) % 50 === 0) console.log(`Prepared ${index + 1} account credentials.`);
  }
  const historyBefore = await historyFingerprint(db);
  const baseline = digest(students);
  const handover: Handover = { status: "PREPARED", preparedAt: new Date().toISOString(), sessionId: session.id, sessionName: session.name, historyBefore, summary, rows };
  save(path.join(directory, `student-account-backup-${Date.now()}.json`), { students, classes, session, historyBefore }, true);
  save(manifestPath, handover, true);
  console.log("Private rollback snapshot and credentials saved. Applying account setup transaction...");
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reason}))`;
    if (digest(await loadStudents(tx)) !== baseline) throw new Error("Student records changed after planning; transaction aborted.");
    for (const schoolClass of classPlans.values()) if (schoolClass.newClass) await tx.class.create({ data: { id: schoolClass.id, name: schoolClass.name, arm: schoolClass.arm, level: schoolClass.level, capacity: schoolClass.capacity, sessionId: session.id } });
    await tx.user.createMany({ data: rows.filter(r => r.newAccount).map(r => ({ id: r.userId, name: r.fullName, email: r.login, passwordHash: r.passwordHash!, role: "STUDENT" as const, isActive: true })) });
    await tx.student.createMany({ data: rows.filter(r => r.newStudent).map(r => {
      const parts = r.fullName.split(/\s+/);
      return { id: r.studentId, studentId: r.admissionNumber, firstName: parts[0], lastName: parts.length > 1 ? parts.at(-1)! : "", middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
        gender: r.gender, dateOfBirth: null, userId: r.userId, classId: r.classId };
    }) });
    const newEnrollments: Prisma.StudentEnrollmentCreateManyInput[] = [];
    for (const [index, row] of rows.entries()) {
      const existing: Student | undefined = students.find(s => s.id === row.studentId);
      if (existing) await tx.student.update({ where: { id: row.studentId }, data: { userId: row.userId, classId: row.classId, gender: row.gender } });
      const enrollment = existing?.enrollments.find(e => e.sessionId === session.id);
      if (enrollment) await tx.studentEnrollment.update({ where: { id: enrollment.id }, data: { classId: row.classId, status: "ACTIVE", reason } });
      else newEnrollments.push({ studentId: row.studentId, classId: row.classId, sessionId: session.id, status: "ACTIVE", enrolledAt: new Date(), reason });
      if ((index + 1) % 75 === 0) console.log(`Linked ${index + 1}/${rows.length} pupils.`);
    }
    if (newEnrollments.length) await tx.studentEnrollment.createMany({ data: newEnrollments });
    await tx.auditLog.createMany({ data: rows.map(row => ({ userId: row.userId, action: row.newStudent ? "CREATE" as const : "UPDATE" as const, entity: "Student", entityId: row.studentId, description: `${reason}; ${row.admissionNumber}; ${row.matchMethod}; ${row.newAccount ? "login created" : "existing login preserved"}` })) });
    if (digest(await historyFingerprint(tx)) !== digest(historyBefore)) throw new Error("Historical data changed; rolling back account setup.");
  }, { timeout: 240_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await verify(handover, true);
  handover.status = "COMPLETE"; handover.completedAt = new Date().toISOString(); save(manifestPath, handover);
  writeCredentials(handover);
  console.log("Account setup complete. Login details are in private-imports/student-login-details-2026-2027.txt.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
