import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo accounts cannot be seeded in production.");
  }

  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set SEED_DEFAULT_PASSWORD to at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: "finance@school.edu" },
    update: { name: "Finance Officer", role: "BURSAR_ACCOUNTANT", isActive: true, passwordHash },
    create: { email: "finance@school.edu", name: "Finance Officer", role: "BURSAR_ACCOUNTANT", isActive: true, passwordHash },
  });

  const formClass = await prisma.class.findFirst({
    where: { formTeacher: null },
    orderBy: { name: "asc" },
  });
  if (!formClass) throw new Error("Create at least one class before seeding demo teachers.");

  const formUser = await prisma.user.upsert({
    where: { email: "adaeze@school.edu" },
    update: { name: "Mrs. Adaeze Obi", role: "FORM_TEACHER", isActive: true, passwordHash },
    create: { email: "adaeze@school.edu", name: "Mrs. Adaeze Obi", role: "FORM_TEACHER", isActive: true, passwordHash },
  });
  const formTeacher = await prisma.teacher.upsert({
    where: { userId: formUser.id },
    update: { formClassId: formClass.id },
    create: { userId: formUser.id, employeeId: "DEMO-FORM-001", formClassId: formClass.id },
  });
  await prisma.class.update({ where: { id: formClass.id }, data: { formTeacher: { connect: { id: formTeacher.id } } } });

  const subjectUser = await prisma.user.upsert({
    where: { email: "ngozi@school.edu" },
    update: { name: "Miss Ngozi Eze", role: "SUBJECT_TEACHER", isActive: true, passwordHash },
    create: { email: "ngozi@school.edu", name: "Miss Ngozi Eze", role: "SUBJECT_TEACHER", isActive: true, passwordHash },
  });
  const subjectTeacher = await prisma.teacher.upsert({
    where: { userId: subjectUser.id },
    update: {},
    create: { userId: subjectUser.id, employeeId: "DEMO-SUBJECT-001" },
  });

  const [subject, session] = await Promise.all([
    prisma.subject.findFirst({ orderBy: { name: "asc" } }),
    prisma.academicSession.findFirst({ where: { isCurrent: true } }),
  ]);
  if (subject && session) {
    await prisma.subjectAssignment.upsert({
      where: { teacherId_subjectId_classId: { teacherId: subjectTeacher.id, subjectId: subject.id, classId: formClass.id } },
      update: { sessionId: session.id },
      create: { teacherId: subjectTeacher.id, subjectId: subject.id, classId: formClass.id, sessionId: session.id },
    });
  }

  console.log("Demo finance and teacher accounts are ready.");
}

main()
  .finally(async () => prisma.$disconnect());
