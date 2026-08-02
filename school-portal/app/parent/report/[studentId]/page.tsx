import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import ReportCard from "@/components/results/ReportCard";
import { Printer, Download } from "lucide-react";
import Link from "next/link";
import type { Term } from "@/types";

export default async function ParentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string; sessionId?: string }>;
}) {
  const session = await getSession();
  if (!session || session.user.role !== "PARENT") redirect("/auth/signin");

  const { studentId } = await params;
  const query = await searchParams;
  const term = (query.term ?? "FIRST") as Term;

  // Authorization: a parent can only view a pupil explicitly linked to their account.
  const link = await prisma.parentStudent.findFirst({
    where: { studentId, parent: { userId: session.user.id } },
    select: { id: true },
  });
  if (!link) notFound();

  const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  const sessionId      = query.sessionId ?? currentSession?.id ?? "";

  const [student, results, broadSheet, attendance, comments] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { select: { name:true, arm:true } } },
    }),
    prisma.result.findMany({
      where: { studentId, sessionId, term, status: { in: ["APPROVED","LOCKED"] } },
      include: { subject: { select: { name:true, code:true } } },
      orderBy: { subject: { name:"asc" } },
    }),
    prisma.broadSheet.findFirst({ where: { studentId, sessionId, term } }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { studentId, sessionId },
      _count: { status: true },
    }),
    prisma.resultComment.findMany({
      where: { studentId, sessionId, term },
      include: { teacher: { include: { user: { select: { name:true } } } } },
    }),
  ]);

  if (!student) notFound();

  const formTeacherComment = comments.find(c => c.type === "FORM_TEACHER")?.comment;
  const principalComment   = comments.find(c => c.type === "PRINCIPAL")?.comment;

  const attPresent = attendance.find(a => a.status === "PRESENT")?._count?.status ?? 0;
  const attAbsent  = attendance.find(a => a.status === "ABSENT")?._count?.status  ?? 0;
  const attLate    = attendance.find(a => a.status === "LATE")?._count?.status    ?? 0;

  const subjectResults = results.map(r => ({
    subjectName: r.subject.name,
    subjectCode: r.subject.code,
    ca1: r.ca1, ca2: r.ca2, ca3: r.ca3,
    examScore: r.examScore, total: r.total,
    grade: r.grade, remark: r.remark, position: r.position,
    maxCA1: r.maxCA1, maxCA2: r.maxCA2, maxCA3: r.maxCA3,
    maxExam: r.maxExam, maxTotal: r.maxTotal,
  }));

  return (
    <div className="space-y-5">
      {/* Controls (hidden on print) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <Link href="/parent/dashboard" className="text-sm text-brand-600 hover:underline">← Back</Link>
          <h1 className="font-display text-xl font-bold text-ink mt-1">
            Report Card — {student.firstName} {student.lastName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Term selector */}
          <div className="flex gap-1">
            {(["FIRST","SECOND","THIRD"] as Term[]).map(t => (
              <Link key={t} href={`/parent/report/${studentId}?term=${t}&sessionId=${sessionId}`}
                className={`btn-sm ${term===t?"btn-primary":"btn-secondary"}`}>
                {t === "FIRST" ? "1st" : t === "SECOND" ? "2nd" : "3rd"}
              </Link>
            ))}
          </div>
          <a href={`/api/report/${studentId}?term=${term}&sessionId=${sessionId}`}
            className="btn-secondary btn-sm gap-2" target="_blank">
            <Download className="w-3.5 h-3.5"/> PDF
          </a>
          <button onClick={undefined} className="btn-primary btn-sm gap-2"
            suppressHydrationWarning
            // Use inline onClick for print since this is a server component
          >
            <Printer className="w-3.5 h-3.5"/> Print
          </button>
        </div>
      </div>

      {results.length === 0 && (
        <div className="card card-body text-center py-8 text-muted text-sm no-print">
          No approved results found for {term.toLowerCase()} term. Results may still be pending approval.
        </div>
      )}

      <ReportCard
        school={{
          name:    "Model Primary & Secondary School",
          address: "14 Education Road, Lagos State, Nigeria",
          motto:   "Excellence Through Knowledge",
        }}
        student={{
          name:        `${student.firstName} ${student.middleName ? student.middleName + " " : ""}${student.lastName}`,
          studentId:   student.studentId,
          className:   `${student.class?.name ?? ""} ${student.class?.arm ?? ""}`.trim(),
          gender:      student.gender,
          dateOfBirth: new Date(student.dateOfBirth).toLocaleDateString("en-NG", { day:"numeric", month:"long", year:"numeric" }),
          photoUrl:    student.photoUrl ?? undefined,
        }}
        session={currentSession?.name ?? sessionId}
        term={term}
        results={subjectResults}
        summary={{
          totalScore:   broadSheet?.totalScore   ?? 0,
          averageScore: broadSheet?.averageScore ?? 0,
          position:     broadSheet?.position     ?? 0,
          outOf:        broadSheet?.outOf        ?? 0,
          isLocked:     broadSheet?.isLocked     ?? false,
        }}
        formTeacherComment={formTeacherComment}
        principalComment={principalComment}
        attendance={{ present: attPresent, absent: attAbsent, late: attLate, total: attPresent + attAbsent + attLate }}
        isLocked={broadSheet?.isLocked}
      />

      {/* Print trigger script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('button').forEach(b => {
          if(b.textContent?.includes('Print')) b.onclick = () => window.print();
        });
      `}}/>
    </div>
  );
}
