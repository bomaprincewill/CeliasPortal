"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { studentIdFromApplication, validatePromotionSelection } from "@/lib/enrollmentValidation";

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(session.user.role)) throw new Error("UNAUTHORIZED");
  return session;
}

export async function enrollApplicant(userId: string, classId: string) {
  const session = await requireAdmin();
  const [applicantUser, targetClass] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, role: "APPLICANT", isActive: true }, include: { applicant: true } }),
    prisma.class.findUnique({ where: { id: classId }, include: { _count: { select: { students: true } } } }),
  ]);
  if (!applicantUser?.applicant) return { success: false, error: "Approved applicant not found." };
  if (!targetClass) return { success: false, error: "Destination class not found." };
  if (targetClass._count.students >= targetClass.capacity) return { success: false, error: "The destination class is at capacity." };
  const existingStudent = await prisma.student.findUnique({ where: { userId } });
  if (existingStudent) return { success: false, error: "This applicant is already enrolled." };
  const studentId = studentIdFromApplication(applicantUser.applicant.applicationNo);

  const student = await prisma.$transaction(async tx => {
    const created = await tx.student.create({ data: {
      userId, studentId, firstName: applicantUser.applicant!.firstName, lastName: applicantUser.applicant!.lastName,
      middleName: applicantUser.applicant!.middleName, dateOfBirth: applicantUser.applicant!.dateOfBirth,
      gender: applicantUser.applicant!.gender, address: applicantUser.applicant!.address, photoUrl: applicantUser.applicant!.photoUrl,
      classId, status: "ACTIVE", isActive: true,
    } });
    await tx.studentEnrollment.create({ data: { studentId: created.id, classId, sessionId: targetClass.sessionId, createdById: session.user.id } });
    await tx.applicant.update({ where: { id: applicantUser.applicant!.id }, data: { status: "ACCEPTED", offerDate: applicantUser.applicant!.offerDate ?? new Date() } });
    await tx.user.update({ where: { id: userId }, data: { role: "STUDENT" } });
    return created;
  });
  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "Student", entityId: student.id, description: `Enrolled applicant ${applicantUser.name} in ${targetClass.name} ${targetClass.arm}`, newValue: { studentId, classId, sessionId: targetClass.sessionId } });
  revalidatePath("/admin/applicants"); revalidatePath("/admin/enrollments");
  return { success: true, studentId };
}

export async function promoteStudents(input: { sourceClassId: string; targetClassId: string; studentIds: string[] }) {
  const session = await requireAdmin();
  const selectionError = validatePromotionSelection(input);
  if (selectionError) return { success: false, error: selectionError };
  const [source, target, students] = await Promise.all([
    prisma.class.findUnique({ where: { id: input.sourceClassId } }),
    prisma.class.findUnique({ where: { id: input.targetClassId }, include: { _count: { select: { students: true } } } }),
    prisma.student.findMany({ where: { id: { in: input.studentIds }, classId: input.sourceClassId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!source || !target) return { success: false, error: "A selected class no longer exists." };
  if (source.sessionId === target.sessionId) return { success: false, error: "Promotion must move students into a different academic session." };
  if (students.length !== input.studentIds.length) return { success: false, error: "One or more selected students are no longer active in the source class." };
  if (target._count.students + students.length > target.capacity) return { success: false, error: "The destination class does not have enough capacity." };

  await prisma.$transaction(async tx => {
    for (const student of students) {
      const previous = await tx.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: student.id, sessionId: source.sessionId } } });
      if (previous) await tx.studentEnrollment.update({ where: { id: previous.id }, data: { status: "PROMOTED", endedAt: new Date() } });
      await tx.studentEnrollment.create({ data: { studentId: student.id, classId: target.id, sessionId: target.sessionId, promotedFromId: previous?.id, createdById: session.user.id } });
    }
    await tx.student.updateMany({ where: { id: { in: input.studentIds } }, data: { classId: target.id } });
  });
  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "StudentEnrollment", description: `Promoted ${students.length} student(s) from ${source.name} ${source.arm} to ${target.name} ${target.arm}`, newValue: input });
  revalidatePath("/admin/enrollments"); revalidatePath("/admin/classes");
  return { success: true, count: students.length };
}

export async function changeStudentLifecycle(studentId: string, status: "TRANSFERRED" | "WITHDRAWN" | "GRADUATED", reason: string) {
  const session = await requireAdmin();
  if (!reason.trim()) return { success: false, error: "A reason is required." };
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: true } });
  if (!student || student.status !== "ACTIVE") return { success: false, error: "Active student not found." };
  await prisma.$transaction([
    prisma.student.update({ where: { id: studentId }, data: { status, isActive: false, classId: null } }),
    prisma.studentEnrollment.updateMany({ where: { studentId, status: "ACTIVE" }, data: { status, reason: reason.trim(), endedAt: new Date() } }),
  ]);
  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "Student", entityId: studentId, description: `Student marked ${status.toLowerCase()}`, newValue: { status, reason: reason.trim() } });
  revalidatePath("/admin/enrollments");
  return { success: true };
}
