import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { nextSchoolClass } from "../lib/sessionPromotion";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");
const policy = process.argv.find(arg => arg.startsWith("--final-year="))?.split("=")[1];
if (policy !== "graduate" && policy !== "retain") throw new Error("Specify --final-year=graduate or --final-year=retain. Without --execute this script is read-only.");
const finalYear = policy as "graduate" | "retain";
const reason = "Session rollover 2025/2026 to 2026/2027";

async function loadPlan(db: Prisma.TransactionClient) {
  const sessions = await db.academicSession.findMany({ where: { name: { in: ["2025/2026", "2026/2027"] } } });
  const sources = sessions.filter(item => item.name === "2025/2026");
  const targets = sessions.filter(item => item.name === "2026/2027");
  if (sources.length !== 1 || targets.length !== 1) throw new Error("Expected exactly one source and one target session.");
  const source = sources[0], target = targets[0];
  if (!target.isCurrent || target.startDate <= source.startDate) throw new Error("Destination must be the current, later academic session.");
  const classes = await db.class.findMany({ where: { sessionId: { in: [source.id, target.id] } }, include: { subjectAssignments: true } });
  const sourceClasses = classes.filter(item => item.sessionId === source.id);
  const targetClasses = classes.filter(item => item.sessionId === target.id);
  const students = await db.student.findMany({
    where: { OR: [{ class: { sessionId: source.id } }, { enrollments: { some: { sessionId: source.id } } }] },
    include: { enrollments: { where: { sessionId: { in: [source.id, target.id] } } } },
    orderBy: { id: "asc" },
  });
  const plans = sourceClasses.map(schoolClass => {
    const cohort = students.filter(student => (student.enrollments.find(e => e.sessionId === source.id)?.classId ?? student.classId) === schoolClass.id);
    const active = cohort.filter(student => student.status === "ACTIVE" && student.isActive);
    const destination = nextSchoolClass(schoolClass, targetClasses, finalYear);
    const eligible = active.filter(student => {
      const old = student.enrollments.find(e => e.sessionId === source.id);
      const next = student.enrollments.find(e => e.sessionId === target.id);
      if (next) {
        if (!("existing" in destination) || next.classId !== destination.existing?.id || next.status !== "ACTIVE" || student.classId !== next.classId || old?.status !== "PROMOTED") throw new Error(`Conflicting destination enrollment for student ${student.studentId}.`);
        return false;
      }
      if (student.classId !== schoolClass.id || (old && old.status !== "ACTIVE")) throw new Error(`Student ${student.studentId} changed class or enrollment; review before retrying.`);
      return true;
    });
    return { schoolClass, destination, students: eligible, alreadyPromoted: active.length - eligible.length };
  });
  // Check combined destination occupancy, including retained final-year pupils.
  const totals = new Map<string, { capacity: number; incoming: number; existingId?: string }>();
  for (const plan of plans) {
    if (!("existing" in plan.destination) || !plan.students.length) continue;
    const d = plan.destination;
    const key = `${d.name.toLowerCase()}:${d.arm.toLowerCase()}`;
    const entry = totals.get(key) ?? { capacity: d.existing?.capacity ?? d.template?.capacity ?? plan.schoolClass.capacity, incoming: 0, existingId: d.existing?.id };
    entry.incoming += plan.students.length;
    totals.set(key, entry);
  }
  for (const [key, entry] of totals) {
    const occupied = entry.existingId ? await db.student.count({ where: { classId: entry.existingId, status: "ACTIVE", isActive: true } }) : 0;
    if (occupied + entry.incoming > entry.capacity) throw new Error(`Destination ${key} exceeds its capacity; no changes made.`);
  }
  return { source, target, classes, students, plans };
}

async function historyFingerprint(db: Prisma.TransactionClient, sessionId: string) {
  const output: Record<string, { count: number; fingerprint: string }> = {};
  for (const table of ["results", "broad_sheets", "attendance", "result_comments"]) {
    const rows = await db.$queryRaw<{ count: number; fingerprint: string }[]>(Prisma.sql`
      SELECT count(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) AS fingerprint
      FROM ${Prisma.raw(`"${table}"`)} t WHERE t."sessionId" = ${sessionId}`);
    output[table] = rows[0];
  }
  return output;
}

function summary(plan: Awaited<ReturnType<typeof loadPlan>>) {
  return plan.plans.map(p => ({ from: `${p.schoolClass.name} ${p.schoolClass.arm}`, to: "existing" in p.destination ? `${p.destination.name} ${p.destination.arm}` : "GRADUATED", count: p.students.length, alreadyPromoted: p.alreadyPromoted, createClass: "existing" in p.destination && !p.destination.existing && p.students.length > 0 }));
}

async function main() {
  const preview = await loadPlan(prisma);
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", source: preview.source.name, destination: preview.target.name, finalYear, classes: summary(preview) }, null, 2));
  if (!execute) return;
  const changes = preview.plans.reduce((total, item) => total + item.students.length, 0);
  if (!changes) { console.log("No pending promotions. Existing enrollments were validated; no changes made."); return; }
  const before = await historyFingerprint(prisma, preview.source.id);
  const directory = path.resolve("private-imports", "session-rollovers");
  if (!directory.startsWith(`${path.resolve(process.cwd())}${path.sep}`)) throw new Error("Backup path must remain inside the project.");
  mkdirSync(directory, { recursive: true });
  const backupFile = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-2025-2026.json`);
  writeFileSync(backupFile, JSON.stringify({ source: preview.source, target: preview.target, classes: preview.classes, students: preview.students.map(s => ({ id: s.id, studentId: s.studentId, classId: s.classId, status: s.status, isActive: s.isActive, enrollments: s.enrollments })), history: before, plan: summary(preview) }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Rollback snapshot saved: ${backupFile}`);
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reason}))`;
    const plan = await loadPlan(tx);
    if (JSON.stringify(summary(plan)) !== JSON.stringify(summary(preview))) throw new Error("Promotion plan changed after backup; rerun to capture the current state.");
    let promoted = 0, graduated = 0;
    const createdClasses: string[] = [];
    const destinations = new Map<string, string>();
    for (const p of plan.plans) {
      if (!p.students.length) continue;
      const ids = p.students.map(s => s.id);
      const missing = p.students.filter(s => !s.enrollments.some(e => e.sessionId === plan.source.id));
      if (missing.length) await tx.studentEnrollment.createMany({ data: missing.map(s => ({ studentId: s.id, classId: p.schoolClass.id, sessionId: plan.source.id, enrolledAt: plan.source.startDate })) });
      const previous = await tx.studentEnrollment.findMany({ where: { sessionId: plan.source.id, studentId: { in: ids } }, select: { id: true, studentId: true } });
      const previousIds = new Map(previous.map(e => [e.studentId, e.id]));
      if (!("existing" in p.destination)) {
        await tx.studentEnrollment.updateMany({ where: { id: { in: previous.map(e => e.id) } }, data: { status: "GRADUATED", endedAt: plan.source.endDate, reason } });
        await tx.student.updateMany({ where: { id: { in: ids } }, data: { status: "GRADUATED", isActive: false, classId: null } });
        graduated += ids.length;
        continue;
      }
      const d = p.destination;
      const key = `${d.name.toLowerCase()}:${d.arm.toLowerCase()}`;
      let classId = d.existing?.id ?? destinations.get(key);
      if (!classId) {
        const created = await tx.class.create({ data: { name: d.name, arm: d.arm, level: d.level, sessionId: plan.target.id, capacity: d.template?.capacity ?? p.schoolClass.capacity } });
        classId = created.id;
        createdClasses.push(classId);
        const template = plan.classes.find(c => c.id === d.template?.id);
        if (template?.subjectAssignments.length) await tx.subjectAssignment.createMany({ data: template.subjectAssignments.map(a => ({ teacherId: a.teacherId, subjectId: a.subjectId, classId: created.id, sessionId: plan.target.id })), skipDuplicates: true });
      }
      destinations.set(key, classId);
      await tx.studentEnrollment.updateMany({ where: { id: { in: previous.map(e => e.id) } }, data: { status: "PROMOTED", endedAt: plan.source.endDate, reason } });
      await tx.studentEnrollment.createMany({ data: p.students.map(s => ({ studentId: s.id, classId, sessionId: plan.target.id, enrolledAt: plan.target.startDate, promotedFromId: previousIds.get(s.id), reason })) });
      const updated = await tx.student.updateMany({ where: { id: { in: ids }, classId: p.schoolClass.id, status: "ACTIVE", isActive: true }, data: { classId } });
      if (updated.count !== ids.length) throw new Error("A student changed during promotion; transaction rolled back.");
      promoted += ids.length;
    }
    const history = await historyFingerprint(tx, plan.source.id);
    if (JSON.stringify(history) !== JSON.stringify(before)) throw new Error("Historical records changed; transaction rolled back.");
    await tx.auditLog.create({ data: { action: "UPDATE", entity: "SessionPromotion", entityId: plan.target.id, description: `${reason}: ${promoted} promoted, ${graduated} graduated.`, newValue: { sourceSessionId: plan.source.id, targetSessionId: plan.target.id, finalYear, promoted, graduated, createdClasses, classes: summary(plan), historyPreserved: true } } });
    return { promoted, graduated, createdClasses: createdClasses.length, history };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 30_000, timeout: 120_000 });
  console.log(JSON.stringify({ completed: true, ...result }, null, 2));
}

main().catch(error => {
  // Avoid dumping connection strings or arbitrary database error payloads.
  console.error(error instanceof Error && !/postgres|password|connection string/i.test(error.message) ? error.message : "Session promotion failed. Inspect database access and the rollback snapshot.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
