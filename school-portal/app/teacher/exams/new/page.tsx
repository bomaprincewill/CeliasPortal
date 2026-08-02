import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CreateExamForm from "./CreateExamForm";
import { sortClasses } from "@/lib/classSorting";

export default async function NewTeacherExamPage() {
  const session = await getSession();
  if (!session || !["FORM_TEACHER", "SUBJECT_TEACHER"].includes(session.user.role)) {
    redirect("/auth/signin");
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: {
      formClassId: true,
      assignments: { select: { classId: true, subjectId: true } },
    },
  });
  if (!teacher) redirect("/teacher/dashboard");

  const allowedClassIds = new Set(teacher.assignments.map((assignment) => assignment.classId));
  if (session.user.role === "FORM_TEACHER" && teacher.formClassId) {
    allowedClassIds.add(teacher.formClassId);
  }
  const allowedSubjectIds = [...new Set(teacher.assignments.map((assignment) => assignment.subjectId))];

  const [sessions, classes, subjects] = await Promise.all([
    prisma.academicSession.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
    prisma.class.findMany({
      where: { id: { in: [...allowedClassIds] } },
      orderBy: [{ name: "asc" }, { arm: "asc" }],
      select: { id: true, name: true, arm: true },
    }),
    prisma.subject.findMany({
      where: { isActive: true, id: { in: allowedSubjectIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Create CBT Exam</h1>
        <p className="page-subtitle">Create an exam for a class and subject assigned to you.</p>
      </div>
      <CreateExamForm sessions={sessions} classes={sortClasses(classes)} subjects={subjects} />
    </div>
  );
}
