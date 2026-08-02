import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireStudentProfile() {
  const session = await getSession();
  if (!session || session.user.role !== "STUDENT") throw new Error("UNAUTHORIZED");
  const student = await prisma.student.findUnique({ where: { userId: session.user.id }, include: { class: { include: { session: true } } } });
  if (!student) throw new Error("STUDENT_PROFILE_NOT_FOUND");
  return { session, student };
}
