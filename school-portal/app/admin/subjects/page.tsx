import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubjectsClient from "./SubjectsClient";
import { sortClasses } from "@/lib/classSorting";

export default async function SubjectsPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  if (["NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(session.user.role)) redirect("/admin/dashboard");
  const level = getLeadershipLevel(session.user.role);

  const [subjects, classes, teachers] = await Promise.all([
    prisma.subject.findMany({
      where: level ? { assignments: { some: { class: { level: { equals: level, mode: "insensitive" } } } } } : undefined,
      orderBy: { name:"asc" },
      include: {
        assignments: {
          where: level ? { class: { level: { equals: level, mode: "insensitive" } } } : undefined,
          include: {
            teacher: { include: { user: { select:{ name:true } } } },
            class:   { select:{ id:true, name:true, arm:true, _count:{ select:{ students:true } } } },
          },
        },
        _count: { select:{
          assignments: level ? { where: { class: { level: { equals: level, mode: "insensitive" } } } } : true,
          results: level ? { where: { class: { level: { equals: level, mode: "insensitive" } } } } : true,
        } },
      },
    }),
    prisma.class.findMany({ where: level ? { level: { equals: level, mode: "insensitive" } } : undefined, orderBy:[{ name:"asc" },{ arm:"asc" }], select:{ id:true, name:true, arm:true, _count:{ select:{ students:true } } } }),
    prisma.teacher.findMany({
      where: level ? { assignments: { some: { class: { level: { equals: level, mode: "insensitive" } } } } } : undefined,
      include:{ user:{ select:{ name:true } } }, orderBy:{ user:{ name:"asc" } }
    }),
  ]);

  return <SubjectsClient initialSubjects={subjects as never} classes={sortClasses(classes)} teachers={teachers as never}/>;
}
