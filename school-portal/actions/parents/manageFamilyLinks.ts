"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { validateFamilyLinks } from "@/lib/familyLinkValidation";

export async function saveFamilyLinks(parentId: string, studentIds: string[], primaryStudentId?: string) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return { success:false, error:"Unauthorized." };
  const validation = validateFamilyLinks(studentIds, primaryStudentId);
  if (validation) return { success:false, error:validation };
  const [parent, count] = await Promise.all([prisma.parent.findUnique({ where:{ id:parentId }, include:{ children:true } }), prisma.student.count({ where:{ id:{ in:studentIds } } })]);
  if (!parent) return { success:false, error:"Parent account not found." };
  if (count !== studentIds.length) return { success:false, error:"One or more students no longer exist." };
  const oldIds = parent.children.map(item => item.studentId);
  await prisma.$transaction(async tx => {
    await tx.parentStudent.deleteMany({ where:{ parentId } });
    if (studentIds.length) await tx.parentStudent.createMany({ data:studentIds.map(studentId => ({ parentId, studentId, isPrimary:studentId === primaryStudentId })) });
  });
  await writeAuditLog({ userId:session.user.id, action:"UPDATE", entity:"ParentStudent", entityId:parentId, description:`Updated parent links (${studentIds.length} children)`, oldValue:{ studentIds:oldIds }, newValue:{ studentIds, primaryStudentId } });
  revalidatePath("/admin/family-links"); revalidatePath("/admin/users");
  return { success:true };
}
