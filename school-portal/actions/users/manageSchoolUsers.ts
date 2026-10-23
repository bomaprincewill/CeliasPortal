"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolUserSchema, type SchoolUserInput } from "@/lib/userCreationValidation";
import { revalidatePath } from "next/cache";

export async function createSchoolUser(input: SchoolUserInput) {
  const caller = await requireSession(["SUPER_ADMIN"]);
  const parsed = schoolUserSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.$transaction(async tx => {
    if (await tx.user.findUnique({ where: { email: data.email } })) throw new Error("This login already belongs to an account.");
    const schoolClass = data.classId ? await tx.class.findUnique({ where: { id: data.classId }, include: { session: true, formTeacher: true } }) : null;
    if (data.classId && !schoolClass?.session.isCurrent) throw new Error("Choose a class in the current session.");
    if (data.role === "FORM_TEACHER" && schoolClass?.formTeacher) throw new Error("The selected class already has a form teacher.");
    if (data.subjectIds.length && await tx.subject.count({ where: { id: { in: data.subjectIds }, isActive: true } }) !== data.subjectIds.length) throw new Error("Choose active subjects.");
    if (data.subjectIds.length && await tx.subjectAssignment.count({ where: { classId: data.classId, subjectId: { in: data.subjectIds } } })) throw new Error("A selected subject already has a teacher for this class. Use Subjects to change the assignment.");
    if (data.role === "STUDENT" && await tx.student.findUnique({ where: { studentId: data.admissionNumber! } })) throw new Error("This admission number already exists. Use the existing pupil record to avoid creating a duplicate.");
    const created = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash, role: data.role, phone: data.phone || null } });
    if (["FORM_TEACHER", "SUBJECT_TEACHER"].includes(data.role)) {
      const teacher = await tx.teacher.create({ data: { userId: created.id, employeeId: `EMP/${new Date().getFullYear()}/${randomBytes(6).toString("hex").toUpperCase()}`, formClassId: data.role === "FORM_TEACHER" ? data.classId : null } });
      if (data.subjectIds.length) await tx.subjectAssignment.createMany({ data: data.subjectIds.map(subjectId => ({ teacherId: teacher.id, classId: data.classId, sessionId: schoolClass!.sessionId, subjectId })) });
    }
    if (data.role === "STUDENT") {
      const student = await tx.student.create({ data: { userId: created.id, studentId: data.admissionNumber!, firstName: data.firstName!, lastName: data.lastName!, middleName: data.middleName || null, gender: data.gender!, dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00.000Z`) : null, classId: data.classId } });
      await tx.studentEnrollment.create({ data: { studentId: student.id, classId: data.classId, sessionId: schoolClass!.sessionId, createdById: caller.user.id } });
    }
    await tx.auditLog.create({ data: { userId: caller.user.id, action: "CREATE", entity: "User", entityId: created.id, description: `Created ${data.role} account for ${data.name}.`, newValue: { email: data.email, role: data.role, classId: data.classId } } });
    return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, teacher: { include: { formTeacherOfClass: true } }, student: { select: { studentId: true, class: { select: { id: true, name: true, arm: true, level: true } } } } } });
  }, { isolationLevel: "Serializable", timeout: 30000 });
  revalidatePath("/admin/users");
  revalidatePath("/admin/classes");
  return { ...user, passwordSet: true, passwordChangedAt: null };
}

export async function deactivateUser(id: string) {
  const caller = await requireSession(["SUPER_ADMIN"]);
  if (!id || id === caller.user.id) throw new Error("You cannot deactivate your own account.");
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw new Error("User not found.");
    if (user.role === "SUPER_ADMIN" && user.isActive && await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }) <= 1) throw new Error("Keep at least one active Super Admin.");
    await tx.user.update({ where: { id }, data: { isActive: false } });
    await tx.auditLog.create({ data: { userId: caller.user.id, action: "UPDATE", entity: "User", entityId: id, description: `Deactivated login for ${user.name}; school records retained.`, oldValue: { isActive: user.isActive }, newValue: { isActive: false } } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/admin/users");
}
