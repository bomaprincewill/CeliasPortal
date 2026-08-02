import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClassesClient from "./ClassesClient";
import { sortClasses } from "@/lib/classSorting";

export default async function ClassesPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);

  const [classes, teachers, sessions] = await Promise.all([
    prisma.class.findMany({
      where: level ? { level: { equals: level, mode: "insensitive" } } : undefined,
      orderBy: [{ name:"asc" },{ arm:"asc" }],
      include: {
        formTeacher: { include: { user: { select:{ name:true } } } },
        _count: { select:{ students:true, subjectAssignments:true } },
      },
    }),
    prisma.teacher.findMany({
      where: level
        ? { OR: [
            { formTeacherOfClass: { level: { equals: level, mode: "insensitive" } } },
            { assignments: { some: { class: { level: { equals: level, mode: "insensitive" } } } } },
          ] }
        : { formClassId: null },
      include: { user: { select:{ name:true } } },
      orderBy: { user:{ name:"asc" } },
    }),
    prisma.academicSession.findMany({ orderBy:{ startDate:"desc" }, select:{ id:true, name:true, isCurrent:true } }),
  ]);

  return (
    <ClassesClient
      initialClasses={sortClasses(classes) as never}
      teachers={teachers as never}
      sessions={sessions}
      canCreateClass={!["NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(session.user.role)}
      learnerLabel={["NURSERY_HEAD", "PRIMARY_HEAD"].includes(session.user.role) ? "pupils" : "students"}
    />
  );
}
