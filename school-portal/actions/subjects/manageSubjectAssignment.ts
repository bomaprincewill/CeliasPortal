"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSubjectAdmin() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    throw new Error("You are not authorized to manage subject staff.");
  }
}

export async function assignSubjectTeacher(input: { subjectId: string; classId: string; teacherId: string }) {
  await requireSubjectAdmin();
  if (!input.subjectId || !input.classId || !input.teacherId) throw new Error("Subject, class, and staff are required.");

  const [subject, schoolClass, teacher] = await Promise.all([
    prisma.subject.findUnique({ where: { id: input.subjectId }, select: { id: true } }),
    prisma.class.findUnique({ where: { id: input.classId }, select: { id: true, sessionId: true } }),
    prisma.teacher.findUnique({ where: { id: input.teacherId }, select: { id: true } }),
  ]);
  if (!subject || !schoolClass || !teacher) throw new Error("The selected subject, class, or staff member no longer exists.");

  const assignment = await prisma.$transaction(async tx => {
    await tx.subjectAssignment.deleteMany({ where: { subjectId: input.subjectId, classId: input.classId } });
    return tx.subjectAssignment.create({
      data: { ...input, sessionId: schoolClass.sessionId },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        class: { select: { id: true, name: true, arm: true, _count: { select: { students: true } } } },
      },
    });
  });

  revalidatePath("/admin/subjects");
  return { success: true, assignment };
}

export async function removeSubjectTeacher(assignmentId: string) {
  await requireSubjectAdmin();
  if (!assignmentId) throw new Error("Assignment is required.");
  await prisma.subjectAssignment.delete({ where: { id: assignmentId } });
  revalidatePath("/admin/subjects");
  return { success: true };
}
