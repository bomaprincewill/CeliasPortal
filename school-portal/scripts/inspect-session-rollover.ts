import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.academicSession.findMany({ where: { name: { in: ["2025/2026", "2026/2027"] } }, include: { classes: { orderBy: [{ name: "asc" }, { arm: "asc" }], include: { _count: { select: { students: true, enrollments: true, subjectAssignments: true } }, formTeacher: { select: { id: true } } } } } });
  for (const session of sessions) {
    console.log(JSON.stringify({ session: session.name, id: session.id, current: session.isCurrent, start: session.startDate, end: session.endDate, classes: session.classes.map(c => ({ id: c.id, name: c.name, arm: c.arm, level: c.level, capacity: c.capacity, students: c._count.students, enrollments: c._count.enrollments, assignments: c._count.subjectAssignments, formTeacher: Boolean(c.formTeacher) })) }, null, 2));
  }
  const source = sessions.find(s => s.name === "2025/2026");
  if (source) {
    const groups = await prisma.student.groupBy({ by: ["classId", "status", "isActive"], where: { class: { sessionId: source.id } }, _count: { id: true } });
    console.log(JSON.stringify({ sourceStudentGroups: groups }, null, 2));
    const orphaned = await prisma.studentEnrollment.count({ where: { sessionId: source.id, student: { classId: null, isActive: true, status: "ACTIVE" } } });
    console.log(`Active source enrollments without a current class: ${orphaned}`);
  }
}
main().catch(error => { console.error("Inspection failed", (error as { code?: string }).code ?? "UNKNOWN"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
