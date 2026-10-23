import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CompileClient from "./CompileClient";
import { sortClasses } from "@/lib/classSorting";
import { termSchema } from "@/lib/attendanceValidation";

export default async function CompilePage({ searchParams }: { searchParams: Promise<{ classId?: string; sessionId?: string; term?: string }> }) {
  const query = await searchParams;
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

  const selectedSessionId = sessions.find(item => item.id === query.sessionId)?.id ?? sessions.find(item => item.isCurrent)?.id ?? sessions[0]?.id ?? "";
  const selectedClassId = classes.find(item => item.id === query.classId && item.sessionId === selectedSessionId)?.id ?? classes.find(item => item.sessionId === selectedSessionId)?.id ?? "";
  const term = termSchema.safeParse(query.term).success ? termSchema.parse(query.term) : "FIRST";
  return <CompileClient key={`${selectedSessionId}:${selectedClassId}:${term}`} classes={sortClasses(classes)} sessions={sessions} initialSessionId={selectedSessionId} initialClassId={selectedClassId} initialTerm={term} canLock={session.user.role === "SUPER_ADMIN"}/>;
}
