import type { PrismaClient } from "@prisma/client";

const DEMO_USER_EMAILS = [
  "finance@school.edu",
  "adaeze@school.edu",
  "ngozi@school.edu",
  "parent@school.edu",
  "applicant@school.edu",
];

export async function cleanupDemoData(prisma: PrismaClient) {
  const demoStudents = await prisma.student.findMany({
    where: { studentId: { startsWith: "STU/2024/" } },
    select: { id: true },
  });
  const demoStudentIds = demoStudents.map(student => student.id);

  await prisma.cBTSubmission.deleteMany({
    where: {
      OR: [
        { examId: "exam_entrance_2025" },
        ...(demoStudentIds.length ? [{ studentId: { in: demoStudentIds } }] : []),
      ],
    },
  });
  await prisma.exam.deleteMany({ where: { id: "exam_entrance_2025" } });

  if (demoStudentIds.length) {
    await prisma.student.deleteMany({ where: { id: { in: demoStudentIds } } });
  }

  const demoUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_USER_EMAILS } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map(user => user.id);
  if (demoUserIds.length) {
    await prisma.teacher.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.parent.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.applicant.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { description: { contains: "seed", mode: "insensitive" } },
        { entity: "System", action: "CREATE" },
      ],
    },
  });
}
