// app/teacher/results/[classId]/[subjectId]/page.tsx
// ============================================================
// Score entry page for Subject Teachers.
// Fetches existing results server-side, passes to grid.
// ============================================================

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResultInputGrid from "@/components/results/ResultInputGrid";
import type { Term } from "@/types";
import { hasExactSubjectAssignment } from "@/lib/authorization";

interface PageProps {
  params: Promise<{ classId: string; subjectId: string }>;
  searchParams: Promise<{ term?: string; sessionId?: string }>;
}

export default async function ScoreEntryPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  const { classId, subjectId } = await params;
  const query = await searchParams;
  const term      = (query.term      ?? "FIRST")  as Term;
  const sessionId = query.sessionId  ?? "";

  // Subject teacher ownership check (belt-and-suspenders: middleware already checked)
  if (session.user.role === "SUBJECT_TEACHER") {
    const isAssigned = await hasExactSubjectAssignment(session.user.id, classId, subjectId);
    if (!isAssigned) notFound();
  }
  if (session.user.role === "FORM_TEACHER" && session.user.formClassId !== classId) {
    notFound();
  }

  // Fetch reference data
  const [classRecord, subject, academicSession, students, existingResults] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, arm: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true, code: true } }),
    sessionId
      ? prisma.academicSession.findUnique({ where: { id: sessionId }, select: { id: true, name: true } })
      : prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true, name: true } }),
    prisma.student.findMany({
      where:   { classId, isActive: true },
      select:  { id: true, studentId: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.result.findMany({
      where: { classId, subjectId, sessionId: sessionId || "", term },
      select: {
        studentId: true,
        ca1: true, ca2: true, ca3: true, examScore: true,
        maxCA1: true, maxCA2: true, maxCA3: true, maxExam: true,
        status: true,
      },
    }),
  ]);

  if (!classRecord || !subject || !academicSession) notFound();

  const resultMap = new Map(existingResults.map((r) => [r.studentId, r]));

  const maxCA1  = existingResults[0]?.maxCA1  ?? 10;
  const maxCA2  = existingResults[0]?.maxCA2  ?? 10;
  const maxCA3  = existingResults[0]?.maxCA3  ?? 10;
  const maxExam = existingResults[0]?.maxExam ?? 70;

  const initialRows = students.map((s) => {
    const result = resultMap.get(s.id);
    return {
      studentId: s.id,
      studentNo: s.studentId,
      name:      `${s.lastName}, ${s.firstName}`,
      ca1:       result?.ca1       ?? null,
      ca2:       result?.ca2       ?? null,
      ca3:       result?.ca3       ?? null,
      examScore: result?.examScore ?? null,
      isLocked:  result?.status === "LOCKED",
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <ResultInputGrid
        classId={classId}
        subjectId={subjectId}
        sessionId={academicSession.id}
        term={term}
        className={`${classRecord.name} ${classRecord.arm}`}
        subjectName={`${subject.name} (${subject.code})`}
        sessionName={academicSession.name}
        maxCA1={maxCA1}
        maxCA2={maxCA2}
        maxCA3={maxCA3}
        maxExam={maxExam}
        initialRows={initialRows}
      />
    </div>
  );
}
