import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ResultsAdminClient from "./ResultsAdminClient";
import { sortClasses } from "@/lib/classSorting";

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<{ classId?:string; term?:string; sessionId?:string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);

  const currentSession = await prisma.academicSession.findFirst({ where:{ isCurrent:true } });
  const sessionId = query.sessionId ?? currentSession?.id ?? "";
  const term      = query.term ?? "FIRST";
  const scopedClasses = sortClasses(await prisma.class.findMany({
    where: level ? { level: { equals: level, mode: "insensitive" } } : undefined,
    orderBy:[{ name:"asc" },{ arm:"asc" }],
    select:{ id:true, name:true, arm:true },
  }));
  const classId = scopedClasses.some((item) => item.id === query.classId) ? query.classId! : "";

  const [classes, subjects, resultGroups] = await Promise.all([
    Promise.resolve(scopedClasses),
    prisma.subject.findMany({ where:{ isActive:true, ...(level ? { assignments: { some: { class: { level: { equals: level, mode: "insensitive" as const } } } } } : {}) }, orderBy:{ name:"asc" }, select:{ id:true, name:true, code:true } }),
    prisma.result.groupBy({
      by: ["classId","subjectId","status"],
      where: {
        sessionId,
        term: term as any,
        ...(classId ? { classId } : {}),
        ...(level ? { class: { level: { equals: level, mode: "insensitive" as const } } } : {}),
      },
      _count: { id:true },
    }),
  ]);

  return (
    <ResultsAdminClient
      classes={classes}
      subjects={subjects}
      resultGroups={resultGroups as never}
      sessionId={sessionId}
      sessionName={currentSession?.name ?? ""}
      initialTerm={term}
      initialClassId={classId}
    />
  );
}
