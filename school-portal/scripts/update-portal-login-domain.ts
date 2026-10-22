/** Run from school-portal with --dry-run or --execute. Only the login domain changes. */
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { planPortalLoginDomain, PORTAL_LOGIN_DOMAIN, updatedPortalLogin } from "../lib/portalLoginDomain";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const directory = path.resolve("private-imports");
const manifestFiles = ["student-account-handover-2026-2027.json", "staff-account-handover-2026-2027.json"];
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const save = (file: string, value: unknown, exclusive = false) => writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2), { flag: exclusive ? "wx" : "w", mode: 0o600 });
async function loadUsers(client: Prisma.TransactionClient = db) {
  return client.user.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, email: true, passwordHash: true, role: true, isActive: true } });
}

async function main() {
  const users = await loadUsers();
  const changes = planPortalLoginDomain(users);
  const manifests = manifestFiles.map(file => ({ file, value: JSON.parse(readFileSync(path.join(directory, file), "utf8")) }));
  for (const { value } of manifests) {
    if (value.status !== "COMPLETE") throw new Error("Complete the account setup before changing login domains.");
    for (const row of value.rows) if (row.userId) {
      const user = users.find(user => user.id === row.userId);
      if (!user || updatedPortalLogin(user.email) !== updatedPortalLogin(row.login)) throw new Error("The saved login handover disagrees with the database; review it before proceeding.");
    }
  }
  const summary = { domain: PORTAL_LOGIN_DOMAIN, accountsToUpdate: changes.length, students: changes.filter(change => users.find(user => user.id === change.userId)!.role === "STUDENT").length,
    staff: changes.filter(change => users.find(user => user.id === change.userId)!.role !== "STUDENT").length };
  save("portal-login-domain-plan.json", { summary, changes });
  console.log(JSON.stringify(summary));
  if (!process.argv.includes("--execute")) return;
  if (changes.length) {
    save(`portal-login-domain-backup-${Date.now()}.json`, { users, manifests, changes }, true);
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('Portal login domain update'))`;
      if (digest(await loadUsers(tx)) !== digest(users)) throw new Error("Account state changed after planning; transaction aborted.");
      const values = Prisma.join(changes.map(change => Prisma.sql`(${change.userId}, ${change.oldLogin}, ${change.newLogin})`));
      const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "users" AS u SET "email" = v."newLogin", "updatedAt" = NOW()
        FROM (VALUES ${values}) AS v("id", "oldLogin", "newLogin")
        WHERE u."id" = v."id" AND u."email" = v."oldLogin"
        RETURNING u."id"`);
      if (updated.length !== changes.length) throw new Error("Not all login names were updated; transaction aborted.");
      const after = await loadUsers(tx);
      for (const user of after) {
        const before = users.find(original => original.id === user.id)!;
        if (user.email !== updatedPortalLogin(before.email) || digest({ ...user, email: before.email }) !== digest(before)) throw new Error("An account changed unexpectedly; transaction aborted.");
      }
      await tx.auditLog.createMany({ data: changes.map(change => ({ userId: change.userId, action: "UPDATE" as const, entity: "User", entityId: change.userId, description: `Portal login domain changed to ${PORTAL_LOGIN_DOMAIN}; password and role preserved` })) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }
  const verified = await loadUsers();
  for (const change of changes) {
    const current = verified.find(user => user.id === change.userId)!;
    const before = users.find(user => user.id === change.userId)!;
    if (current.email !== change.newLogin || current.passwordHash !== before.passwordHash || current.role !== before.role) throw new Error("Final domain update verification failed.");
  }
  for (const { file, value } of manifests) {
    for (const row of value.rows) row.login = row.userId ? verified.find(user => user.id === row.userId)!.email : updatedPortalLogin(row.login);
    value.loginFormat = `name@${PORTAL_LOGIN_DOMAIN}`; value.loginsUpdatedAt = new Date().toISOString(); save(file, value);
  }
  for (const file of ["student-roster-2026-2027.json", "staff-roster-2026-2027.json"]) if (existsSync(path.join(directory, file))) {
    const value = JSON.parse(readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, ""));
    value.loginFormat = `name@${PORTAL_LOGIN_DOMAIN}`; save(file, value);
  }
  console.log(JSON.stringify({ databaseLoginsVerified: changes.length, passwordsPreserved: true, rolesPreserved: true, privateManifestsUpdated: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
