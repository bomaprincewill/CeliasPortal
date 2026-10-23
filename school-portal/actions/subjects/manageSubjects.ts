"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const subjectSchema = z.object({
  id: z.string().min(1).optional(), name: z.string().trim().min(1).max(120), code: z.string().trim().min(1).max(20).transform(value => value.toUpperCase()),
  description: z.string().trim().max(1000), classIds: z.array(z.string().min(1)).max(200),
  assignments: z.array(z.object({ classId: z.string().min(1), teacherId: z.string().min(1) })).max(200),
}).refine(data => new Set(data.classIds).size === data.classIds.length && new Set(data.assignments.map(item => item.classId)).size === data.assignments.length, "Choose each class only once.")
  .refine(data => data.classIds.length === data.assignments.length && data.classIds.every(id => data.assignments.some(item => item.classId === id)), "Choose a teacher for each selected class.");

export async function saveSubject(input: z.input<typeof subjectSchema>) {
  const caller = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const { id, classIds, assignments } = parsed.data;
  const data = { name: parsed.data.name, code: parsed.data.code, description: parsed.data.description };
  const subject = await prisma.$transaction(async tx => {
    const duplicate = await tx.subject.findFirst({ where: { code: { equals: data.code, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
    if (duplicate) throw new Error("This subject code already exists. Choose a different code.");
    const classes = await tx.class.findMany({ where: { id: { in: classIds }, session: { isCurrent: true } } });
    if (classes.length !== classIds.length) throw new Error("Assignments must use current-session classes.");
    const teacherIds = [...new Set(assignments.map(item => item.teacherId))];
    if (await tx.teacher.count({ where: { id: { in: teacherIds }, user: { isActive: true } } }) !== teacherIds.length) throw new Error("Choose active teachers for assignments.");
    const saved = id ? await tx.subject.update({ where: { id }, data }) : await tx.subject.create({ data });
    // Historical assignments are retained when changing the current timetable.
    await tx.subjectAssignment.deleteMany({ where: { subjectId: saved.id, class: { session: { isCurrent: true } } } });
    for (const assignment of assignments) {
      await tx.subjectAssignment.create({ data: { classId: assignment.classId, teacherId: assignment.teacherId, subjectId: saved.id, sessionId: classes.find(item => item.id === assignment.classId)!.sessionId } });
    }
    await tx.auditLog.create({ data: { userId: caller.user.id, action: id ? "UPDATE" : "CREATE", entity: "Subject", entityId: saved.id, description: `${id ? "Updated" : "Created"} subject ${data.name}.`, newValue: { ...data, assignments } } });
    return tx.subject.findUniqueOrThrow({ where: { id: saved.id }, include: { assignments: { include: { teacher: { include: { user: { select: { name: true } } } }, class: { select: { id: true, name: true, arm: true, _count: { select: { students: true } } } } } }, _count: { select: { assignments: true, results: true } } } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/admin/subjects");
  return subject;
}

export async function retireSubject(id: string) {
  const caller = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  if (!id) throw new Error("Choose a subject.");
  await prisma.$transaction(async tx => {
    const subject = await tx.subject.update({ where: { id }, data: { isActive: false } });
    await tx.auditLog.create({ data: { userId: caller.user.id, action: "UPDATE", entity: "Subject", entityId: id, description: `Retired ${subject.name}; historical results and assignments retained.` } });
  });
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/results");
}
