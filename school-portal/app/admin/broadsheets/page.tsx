import { redirect } from "next/navigation";
import BroadSheet from "@/components/results/BroadSheet";
import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { Term } from "@/types";
import { sortClasses } from "@/lib/classSorting";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

interface PageProps {
  searchParams: Promise<{
    classId?: string;
    sessionId?: string;
    term?: string;
  }>;
}

export default async function AdminBroadSheetsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const userSession = await getSession();
  if (!userSession || !isAdminRole(userSession.user.role)) {
    redirect("/auth/signin");
  }
  const level = getLeadershipLevel(userSession.user.role);

  const [classes, academicSessions] = await Promise.all([
    prisma.class.findMany({
      where: level ? { level: { equals: level, mode: "insensitive" } } : undefined,
      orderBy: [{ name: "asc" }, { arm: "asc" }],
      select: { id: true, name: true, arm: true, sessionId: true },
    }),
    prisma.academicSession.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true },
    }),
  ]);

  const numericallySortedClasses = sortClasses(classes);
  const currentSession = academicSessions.find((item) => item.isCurrent) ?? academicSessions[0];
  const selectedSessionId = query.sessionId ?? currentSession?.id ?? "";
  const sessionClasses = numericallySortedClasses.filter((item) => item.sessionId === selectedSessionId);
  const selectedClassId =
    sessionClasses.some((item) => item.id === query.classId)
      ? query.classId!
      : sessionClasses[0]?.id ?? "";
  const term = TERMS.includes(query.term as Term)
    ? (query.term as Term)
    : "FIRST";

  const selectedClass = numericallySortedClasses.find((item) => item.id === selectedClassId);
  const selectedSession = academicSessions.find((item) => item.id === selectedSessionId);

  const [assignments, results, broadSheetRows, students] = selectedClassId
    ? await Promise.all([
        prisma.subjectAssignment.findMany({
          where: { classId: selectedClassId },
          include: { subject: { select: { id: true, name: true, code: true } } },
          distinct: ["subjectId"],
          orderBy: { subject: { name: "asc" } },
        }),
        prisma.result.findMany({
          where: {
            classId: selectedClassId,
            sessionId: selectedSessionId,
            term,
            status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] },
          },
          select: { studentId: true, subjectId: true, total: true, grade: true },
        }),
        prisma.broadSheet.findMany({
          where: { classId: selectedClassId, sessionId: selectedSessionId, term },
          select: {
            studentId: true,
            totalScore: true,
            averageScore: true,
            position: true,
            outOf: true,
            isLocked: true,
          },
        }),
        prisma.student.findMany({
          where: { classId: selectedClassId, isActive: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, studentId: true, firstName: true, lastName: true },
        }),
      ])
    : [[], [], [], []];

  const subjects = assignments.map((assignment) => assignment.subject);
  const broadSheetMap = new Map(broadSheetRows.map((row) => [row.studentId, row]));
  const resultMap = new Map<string, Map<string, { total: number; grade: string }>>();

  for (const result of results) {
    if (!resultMap.has(result.studentId)) resultMap.set(result.studentId, new Map());
    resultMap.get(result.studentId)!.set(result.subjectId, {
      total: result.total ?? 0,
      grade: result.grade ?? "F",
    });
  }

  const studentRows = students
    .map((student) => {
      const summary = broadSheetMap.get(student.id);
      const scores: Record<string, { total: number; grade: string } | null> = {};

      for (const subject of subjects) {
        scores[subject.id] = resultMap.get(student.id)?.get(subject.id) ?? null;
      }

      return {
        studentId: student.id,
        studentNo: student.studentId,
        name: `${student.lastName}, ${student.firstName}`,
        scores,
        cumulative: summary?.totalScore ?? 0,
        average: summary?.averageScore ?? 0,
        position: summary?.position ?? 0,
        outOf: summary?.outOf ?? students.length,
      };
    })
    .sort((a, b) => (a.position || 999) - (b.position || 999));

  return (
    <div className="space-y-5">
      <form className="card card-body grid gap-4 sm:grid-cols-3" method="get">
        <div className="form-group">
          <label className="label" htmlFor="sessionId">Academic session</label>
          <select id="sessionId" name="sessionId" className="input" defaultValue={selectedSessionId}>
            {academicSessions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="label" htmlFor="classId">Class</label>
          <select id="classId" name="classId" className="input" defaultValue={selectedClassId}>
            {sessionClasses.map((item) => (
              <option key={item.id} value={item.id}>{item.name} {item.arm}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="label" htmlFor="term">Term</label>
          <div className="flex gap-2">
            <select id="term" name="term" className="input" defaultValue={term}>
              <option value="FIRST">First term</option>
              <option value="SECOND">Second term</option>
              <option value="THIRD">Third term</option>
            </select>
            <button type="submit" className="btn-primary whitespace-nowrap">View</button>
          </div>
        </div>
      </form>

      {!selectedClass ? (
        <div className="card card-body text-center text-muted">
          No class is available for the selected academic session.
        </div>
      ) : (
        <BroadSheet
          classId={selectedClass.id}
          className={`${selectedClass.name} ${selectedClass.arm}`}
          sessionName={selectedSession?.name ?? selectedSessionId}
          term={term}
          subjects={subjects}
          students={studentRows}
          isLocked={broadSheetRows.some((row) => row.isLocked)}
        />
      )}
    </div>
  );
}
