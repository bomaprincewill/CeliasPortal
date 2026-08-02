import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";
import { sortClasses } from "@/lib/classSorting";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/auth/signin");

  const [users, classes, subjects, academicSessions, passwordChanges] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { include: { formTeacherOfClass: { select: { id:true, name:true, arm:true } }, assignments: { include: { subject:{ select:{name:true} }, class:{ select:{name:true,arm:true} } } } } },
        parent:  { include: { children: { include: { student: { select:{ firstName:true, lastName:true, studentId:true } } } } } },
        applicant: { select: { id:true, applicationNo:true, status:true } },
        student: { select: { studentId:true, class:{ select:{ level:true } } } },
      },
    }),
    prisma.class.findMany({ orderBy: [{ name:"asc" },{ arm:"asc" }] }),
    prisma.subject.findMany({ where:{ isActive:true }, orderBy:{ name:"asc" } }),
    prisma.academicSession.findMany({ orderBy:{ startDate:"desc" }, select:{ name:true, isCurrent:true } }),
    prisma.auditLog.findMany({
      where: { entity: "User", action: "UPDATE", OR: [
        { description: { startsWith: "Password reset completed" } },
        { description: { startsWith: "Password changed for" } },
        { description: { startsWith: "Password changed by account owner" } },
      ] },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, createdAt: true },
    }),
  ]);

  const changedAtByUser = new Map<string, Date>();
  for (const change of passwordChanges) {
    if (change.entityId && !changedAtByUser.has(change.entityId)) changedAtByUser.set(change.entityId, change.createdAt);
  }
  const safeUsers = users.map(({ passwordHash, ...user }) => ({
    ...user,
    passwordSet: Boolean(passwordHash),
    passwordChangedAt: changedAtByUser.get(user.id)?.toISOString() ?? null,
  }));

  return <UsersClient initialUsers={safeUsers as never} classes={sortClasses(classes)} subjects={subjects} academicSessions={academicSessions}/>;
}
