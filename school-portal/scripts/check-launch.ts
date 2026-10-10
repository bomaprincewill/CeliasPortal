import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { readdirSync } from "node:fs";
import { validateLaunchEnvironment } from "../lib/launchValidation";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const dataOnly = process.argv.includes("--data-only");
const configOnly = process.argv.includes("--config-only");
let blockers = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`${passed ? "PASS" : "BLOCK"} ${label}: ${detail}`);
  if (!passed) blockers++;
}

async function main() {
  if (!dataOnly) {
    const issues = validateLaunchEnvironment(process.env);
    check("Production configuration", issues.length === 0, issues.length ? issues.join(" ") : "Required settings are present. Provider verification is still required.");
  }
  if (!configOnly) {
    await prisma.$queryRaw`SELECT 1`;
    check("Database connection", true, "Reachable.");
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const expected = readdirSync("migrations", { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    const missing = expected.filter(name => !migrations.some(row => row.migration_name === name));
    check("Database migrations", missing.length === 0, missing.length ? `Pending: ${missing.join(", ")}` : "All repository migrations applied.");
    const current = await prisma.academicSession.findMany({ where: { isCurrent: true }, select: { id: true, name: true, endDate: true } });
    check("Current academic session", current.length === 1 && current[0].endDate > new Date(), current.length === 1 ? `${current[0].name}${current[0].endDate <= new Date() ? " has ended." : " is current."}` : `${current.length} sessions marked current; expected one.`);
    const settings = await prisma.schoolSetting.findUnique({ where: { id: "default" } });
    check("School settings", Boolean(settings?.name && settings?.address), settings ? "School details exist; confirm them with the school." : "Configure school details.");
    const demoEmails = ["admin@school.edu", "finance@school.edu", "adaeze@school.edu", "ngozi@school.edu", "parent@school.edu", "applicant@school.edu"];
    const demoCount = await prisma.user.count({ where: { email: { in: demoEmails }, isActive: true } });
    check("Demo accounts", demoCount === 0, `${demoCount} active seed accounts.`);
    const owners = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true, passwordHash: { not: null }, email: { notIn: demoEmails } } });
    check("Production owner account", owners > 0, `${owners} active non-demo Super Admin account(s).`);
    const teacherCount = await prisma.teacher.count({ where: { user: { isActive: true } } });
    console.log(`INFO Teachers: ${teacherCount} active teacher profiles.`);
    const studentCount = await prisma.student.count({ where: { isActive: true, status: "ACTIVE" } });
    const eligible = { isActive: true, status: "ACTIVE" as const };
    const eligibleCount = await prisma.student.count({ where: eligible });
    const missingLogins = await prisma.student.count({ where: { AND: [eligible, { OR: [{ userId: null }, { user: { isActive: false } }, { user: { passwordHash: null } }, { user: { role: { not: "STUDENT" } } }] }] } });
    check("Student logins", studentCount > 0 && missingLogins === 0, `${eligibleCount} eligible students; ${missingLogins} lack usable logins. Families view results using each pupil's student account.`);
    console.log("INFO Parent access: separate parent accounts and family links are optional and do not block launch.");
    if (current.length === 1) {
      const enrolled = await prisma.studentEnrollment.count({ where: { sessionId: current[0].id, status: "ACTIVE", student: { isActive: true, status: "ACTIVE" } } });
      check("Current-session enrollments", enrolled > 0, `${enrolled} active enrollments in ${current[0].name}; confirm promotions and new admissions with the school.`);
      const unassigned = await prisma.class.count({ where: { sessionId: current[0].id, students: { some: { isActive: true, status: "ACTIVE" } }, formTeacher: null } });
      check("Form teacher assignments", unassigned === 0, `${unassigned} occupied current-session classes lack form teachers.`);
      const currentAssignments = await prisma.subjectAssignment.count({ where: { class: { sessionId: current[0].id }, teacher: { user: { isActive: true } } } });
      console.log(`INFO Teaching assignments: ${currentAssignments} active teacher/subject/class assignments in ${current[0].name}.`);
    }
    const results = await prisma.result.count();
    console.log(`INFO Results: ${results} records. Compare imported marks and printed reports with source workbooks.`);
  }
  console.log(`Launch check: ${blockers} blocker(s). This read-only check does not verify backups, email delivery, or browser workflows.`);
  if (blockers) process.exitCode = 1;
}

main().catch(error => {
  const code = (error as { code?: string; errorCode?: string }).code ?? (error as { errorCode?: string }).errorCode;
  console.error(`BLOCK Launch check could not complete${code ? ` (${code})` : ""}. Check database access and schema; no records were changed.`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
