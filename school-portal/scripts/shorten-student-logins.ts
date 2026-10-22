/** Run from school-portal with --dry-run or --execute. Passwords are preserved. */
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildStudentLogins } from "../lib/studentLoginNames";
import { PORTAL_LOGIN_DOMAIN } from "../lib/portalLoginDomain";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const directory = path.resolve("private-imports");
const manifestPath = path.join(directory, "student-account-handover-2026-2027.json");
type Row = { userId: string; studentId: string; admissionNumber: string; fullName: string; login: string };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const save = (file: string, value: unknown, exclusive = false) => writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2), { flag: exclusive ? "wx" : "w", mode: 0o600 });
async function loadUsers(ids: string[], client: Prisma.TransactionClient = db) {
  return client.user.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" }, select: {
    id: true, email: true, passwordHash: true, role: true, isActive: true,
    student: { select: { id: true, studentId: true, classId: true } },
  } });
}

async function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const rows: Row[] = manifest.rows;
  if (manifest.status !== "COMPLETE" || rows.length !== 325 || new Set(rows.map(r => r.userId)).size !== rows.length) throw new Error("Expected the completed 325-pupil account handover.");
  const ids = rows.map(r => r.userId);
  const [before, others] = await Promise.all([
    loadUsers(ids), db.user.findMany({ where: { id: { notIn: ids } }, select: { email: true } }),
  ]);
  if (before.length !== rows.length) throw new Error("Some roster accounts are missing.");
  for (const row of rows) {
    const user = before.find(user => user.id === row.userId);
    if (user?.role !== "STUDENT" || !user.isActive || !user.passwordHash || user.student?.id !== row.studentId || user.student.studentId !== row.admissionNumber) throw new Error(`Account identity needs review: ${row.admissionNumber}`);
  }
  const aliases = buildStudentLogins(rows, others.map(user => user.email));
  const plan = rows.map(row => ({ userId: row.userId, admissionNumber: row.admissionNumber, fullName: row.fullName, oldLogin: before.find(u => u.id === row.userId)!.email, newLogin: aliases.get(row.userId)! }));
  const changes = plan.filter(row => row.oldLogin !== row.newLogin);
  save("short-student-login-plan-2026-2027.json", { preparedAt: new Date().toISOString(), accounts: plan.length, changes: changes.length, plan });
  console.log(JSON.stringify({ accounts: plan.length, emailChanges: changes.length, uniqueLogins: new Set(plan.map(row => row.newLogin)).size, passwords: "preserved", examples: plan.slice(0, 3).map(row => row.newLogin) }));
  if (!process.argv.includes("--execute")) return;
  if (changes.length) {
    save(`student-login-backup-${Date.now()}.json`, { manifest, users: before, plan }, true);
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('Short student logins 2026/2027'))`;
      if (digest(await loadUsers(ids, tx)) !== digest(before)) throw new Error("Account state changed after planning; transaction aborted.");
      const values = Prisma.join(changes.map(row => Prisma.sql`(${row.userId}, ${row.oldLogin}, ${row.newLogin})`));
      const changed = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "users" AS u SET "email" = v."newLogin", "updatedAt" = NOW()
        FROM (VALUES ${values}) AS v("id", "oldLogin", "newLogin")
        WHERE u."id" = v."id" AND u."email" = v."oldLogin"
        RETURNING u."id"`);
      if (changed.length !== changes.length) throw new Error("Not every planned email was updated; transaction aborted.");
      const after = await loadUsers(ids, tx);
      for (const user of after) {
        const original = before.find(item => item.id === user.id)!;
        if (user.email !== aliases.get(user.id) || digest({ ...user, email: original.email }) !== digest(original)) throw new Error("An account changed unexpectedly; transaction aborted.");
      }
      await tx.auditLog.createMany({ data: changes.map(row => ({ userId: row.userId, action: "UPDATE" as const, entity: "User", entityId: row.userId, description: `Pupil login renamed to ${row.newLogin}; password and admission number preserved` })) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }
  const verified = await loadUsers(ids);
  for (const user of verified) {
    const original = before.find(item => item.id === user.id)!;
    if (user.email !== aliases.get(user.id) || user.passwordHash !== original.passwordHash) throw new Error("Final account verification failed.");
  }
  for (const row of rows) row.login = aliases.get(row.userId)!;
  manifest.loginFormat = `name@${PORTAL_LOGIN_DOMAIN}`;
  manifest.loginsUpdatedAt = new Date().toISOString();
  save(path.basename(manifestPath), manifest);
  console.log(JSON.stringify({ databaseAccountsVerified: verified.length, passwordsPreserved: verified.length, handoverUpdated: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
