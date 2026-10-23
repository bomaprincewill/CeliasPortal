"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ADMIN_ROLES, assertClassAccess, getLeadershipLevel } from "@/lib/roles";
import { revalidatePath } from "next/cache";

const classSchema = z.object({
  id: z.string().min(1).optional(), name: z.string().trim().min(1).max(80), arm: z.string().trim().min(1).max(40),
  level: z.enum(["nursery", "primary", "secondary"]), sessionId: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(1000), formTeacherId: z.string(),
});

export async function saveClass(input: z.input<typeof classSchema>) {
  const caller = await requireSession(ADMIN_ROLES);
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) throw new Error("Complete the class name, arm, level, session, and a valid capacity.");
  const { id, formTeacherId } = parsed.data;
  const data = { name: parsed.data.name, arm: parsed.data.arm, level: parsed.data.level, sessionId: parsed.data.sessionId, capacity: parsed.data.capacity };
  const level = getLeadershipLevel(caller.user.role);
  if (!id && level) throw new Error("Only school administrators can create classes.");
  if (id) await assertClassAccess(caller.user.role, id);
  if (level && data.level !== level) throw new Error("You can only manage your school level.");
  const saved = await prisma.$transaction(async tx => {
    const academicSession = await tx.academicSession.findUnique({ where: { id: data.sessionId } });
    if (!academicSession?.isCurrent) throw new Error("Manage classes in the current academic session.");
    const previous = id ? await tx.class.findUnique({ where: { id }, include: { formTeacher: true } }) : null;
    if (id && (!previous || previous.sessionId !== data.sessionId)) throw new Error("An existing class cannot be moved to another session.");
    const duplicate = await tx.class.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, arm: { equals: data.arm, mode: "insensitive" }, sessionId: data.sessionId, ...(id ? { id: { not: id } } : {}) } });
    if (duplicate) throw new Error("This class and arm already exist in the selected session.");
    if (formTeacherId) {
      const teacher = await tx.teacher.findUnique({ where: { id: formTeacherId }, include: { user: true } });
      if (!teacher?.user.isActive || !["FORM_TEACHER", "SUBJECT_TEACHER"].includes(teacher.user.role)) throw new Error("Choose an active form or subject teacher.");
      if (teacher.formClassId && teacher.formClassId !== id) throw new Error("This teacher already has a form class. Remove that assignment first.");
    }
    const schoolClass = id ? await tx.class.update({ where: { id }, data }) : await tx.class.create({ data });
    await tx.teacher.updateMany({ where: { formClassId: schoolClass.id }, data: { formClassId: null } });
    if (formTeacherId) {
      const teacher = await tx.teacher.update({ where: { id: formTeacherId }, data: { formClassId: schoolClass.id } });
      await tx.user.updateMany({ where: { id: teacher.userId, role: "SUBJECT_TEACHER" }, data: { role: "FORM_TEACHER" } });
    }
    await tx.auditLog.create({ data: { userId: caller.user.id, action: id ? "UPDATE" : "CREATE", entity: "Class", entityId: schoolClass.id, description: `${id ? "Updated" : "Created"} ${data.name} ${data.arm}.`, newValue: { ...data, formTeacherId } } });
    return tx.class.findUniqueOrThrow({ where: { id: schoolClass.id }, include: { formTeacher: { include: { user: { select: { name: true } } } }, _count: { select: { students: true, subjectAssignments: true } } } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/admin/classes");
  revalidatePath("/teacher/attendance");
  return saved;
}

export async function deleteClass(id: string) {
  const caller = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  if (!id) throw new Error("Choose a class.");
  await prisma.$transaction(async tx => {
    const schoolClass = await tx.class.findUnique({ where: { id }, include: { session: true, _count: { select: { students: true, enrollments: true, results: true, attendance: true, broadSheets: true, exams: true, subjectAssignments: true } } } });
    if (!schoolClass?.session.isCurrent) throw new Error("Only an empty current-session class can be deleted.");
    if (Object.values(schoolClass._count).some(count => count > 0)) throw new Error("This class has linked school records. Keep it to preserve those records.");
    await tx.teacher.updateMany({ where: { formClassId: id }, data: { formClassId: null } });
    await tx.class.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: caller.user.id, action: "DELETE", entity: "Class", entityId: id, description: `Deleted empty class ${schoolClass.name} ${schoolClass.arm}.` } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/admin/classes");
}
