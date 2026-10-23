import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ResultsAdminClient from "./ResultsAdminClient";
import { sortClasses } from "@/lib/classSorting";
import { termSchema } from "@/lib/attendanceValidation";

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<{ classId?:string; term?:string; sessionId?:string; upload?:string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);

  const sessions = await prisma.academicSession.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true, isCurrent: true } });
  const currentSession = sessions.find(item => item.isCurrent);
  const sessionId = query.sessionId ?? currentSession?.id ?? "";
  const selectedSession = sessions.find(item => item.id === sessionId);
  const term = termSchema.safeParse(query.term).success ? termSchema.parse(query.term) : "FIRST";
  const scopedClasses = sortClasses(await prisma.class.findMany({
    where: { sessionId, ...(level ? { level: { equals: level, mode: "insensitive" as const } } : {}) },
    orderBy:[{ name:"asc" },{ arm:"asc" }],
    select:{ id:true, name:true, arm:true },
  }));
  const classId = scopedClasses.some((item) => item.id === query.classId) ? query.classId! : "";

  const [classes, subjects, resultGroups] = await Promise.all([
    Promise.resolve(scopedClasses),
    prisma.subject.findMany({
      where: {
        AND: [
          { OR: [{ isActive: true }, { results: { some: { sessionId } } }] },
          ...(level ? [{ OR: [
            { assignments: { some: { class: { sessionId, level: { equals: level, mode: "insensitive" as const } } } } },
            { results: { some: { sessionId, class: { level: { equals: level, mode: "insensitive" as const } } } } },
          ] }] : []),
        ],
      },
      orderBy: { name: "asc" }, select: { id: true, name: true, code: true, isActive: true },
    }),
    prisma.result.groupBy({
      by: ["classId","subjectId","status","term"],
      where: {
        sessionId,
        term,
        ...(classId ? { classId } : {}),
        ...(level ? { class: { level: { equals: level, mode: "insensitive" as const } } } : {}),
      },
      _count: { id:true },
    }),
  ]);

  return (
    <ResultsAdminClient
      key={`${sessionId}:${term}:${classId}`}
      classes={classes}
      subjects={subjects}
      resultGroups={resultGroups as never}
      sessionId={sessionId}
      sessionName={selectedSession?.name ?? ""}
      sessions={sessions}
      canLock={session.user.role === "SUPER_ADMIN"}
      initialTerm={term}
      initialClassId={classId}
      uploadMode={query.upload === "1"}
    />
  );
}
