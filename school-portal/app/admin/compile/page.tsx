import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CompileClient from "./CompileClient";
import { sortClasses } from "@/lib/classSorting";

export default async function CompilePage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);

  const [classes, sessions] = await Promise.all([
    prisma.class.findMany({
      where: level ? { level: { equals: level, mode: "insensitive" } } : undefined,
      orderBy: [{ level:"asc" },{ name:"asc" },{ arm:"asc" }],
      select:{
        id:true,
        name:true,
        arm:true,
        sessionId:true,
        subjectAssignments:{
          select:{ subject:{ select:{ id:true, name:true, code:true, isActive:true } } },
          orderBy:{ subject:{ name:"asc" } },
        },
      },
    }),
    prisma.academicSession.findMany({ orderBy:{ startDate:"desc" }, select:{ id:true, name:true, isCurrent:true } }),
  ]);

  return <CompileClient classes={sortClasses(classes)} sessions={sessions}/>;
}
