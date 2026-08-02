import { prisma } from "@/lib/prisma";

export const assignmentPairKey = (classId: string, subjectId: string) => `${classId}:${subjectId}`;

export async function hasExactSubjectAssignment(userId: string, classId: string, subjectId: string) {
  const assignment = await prisma.subjectAssignment.findFirst({
    where: { classId, subjectId, teacher: { userId } },
    select: { id: true },
  });
  return Boolean(assignment);
}
