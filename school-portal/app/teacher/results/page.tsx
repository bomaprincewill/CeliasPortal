import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart2, ChevronRight, CheckCircle2, Clock, Lock, Upload } from "lucide-react";
import { TERM_LABELS } from "@/types";
import type { Term } from "@/types";
import { compareClasses } from "@/lib/classSorting";

export default async function TeacherResultsPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !["SUBJECT_TEACHER","FORM_TEACHER","SUPER_ADMIN","ADMIN","NURSERY_HEAD","PRIMARY_HEAD","PRINCIPAL"].includes(session.user.role)) redirect("/auth/signin");

  const term = (query.term ?? "FIRST") as Term;
  const currentSession = await prisma.academicSession.findFirst({ where:{ isCurrent:true } });

  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.user.id },
    include: {
      assignments: {
        include: {
          subject: { select:{ id:true, name:true, code:true } },
          class:   { select:{ id:true, name:true, arm:true } },
        },
      },
    },
  });

  let assignments =
    session.user.role === "FORM_TEACHER" && session.user.formClassId
      ? await prisma.subjectAssignment.findMany({
          where: { classId: session.user.formClassId },
          distinct: ["subjectId"],
          include: {
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true, arm: true } },
          },
        })
      : teacher?.assignments ?? [];

  // Nursery form teachers often teach every learning area themselves, so their
  // class may not have individual subject-assignment rows.
  if (session.user.role === "FORM_TEACHER" && session.user.formClassId && assignments.length === 0) {
    const [formClass, activeSubjects] = await Promise.all([
      prisma.class.findUnique({
        where: { id: session.user.formClassId },
        select: { id: true, name: true, arm: true, level: true },
      }),
      prisma.subject.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
    ]);

    if (formClass?.level.toLowerCase() === "nursery") {
      assignments = activeSubjects.map((subject) => ({
        id: `nursery:${formClass.id}:${subject.id}`,
        teacherId: teacher?.id ?? "",
        classId: formClass.id,
        subjectId: subject.id,
        sessionId: currentSession?.id ?? null,
        createdAt: new Date(0),
        subject,
        class: { id: formClass.id, name: formClass.name, arm: formClass.arm },
      }));
    }
  }

  assignments.sort((a, b) =>
    compareClasses(a.class, b.class) || a.subject.name.localeCompare(b.subject.name)
  );

  // Get result status counts for each assignment
  const statusMap = new Map<string, Record<string, number>>();
  if (assignments.length > 0 && currentSession) {
    const resultGroups = await prisma.result.groupBy({
      by: ["classId","subjectId","status"],
      where: {
        sessionId: currentSession.id,
        term,
        classId:   { in: assignments.map(a => a.classId) },
        subjectId: { in: assignments.map(a => a.subjectId) },
      },
      _count: { id:true },
    });

    for (const g of resultGroups) {
      const key = `${g.classId}:${g.subjectId}`;
      if (!statusMap.has(key)) statusMap.set(key, {});
      statusMap.get(key)![g.status] = g._count.id;
    }
  }

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "LOCKED")    return <Lock className="w-3.5 h-3.5 text-emerald-600"/>;
    if (status === "SUBMITTED") return <CheckCircle2 className="w-3.5 h-3.5 text-brand-600"/>;
    if (status === "APPROVED")  return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/>;
    return <Clock className="w-3.5 h-3.5 text-yellow-500"/>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2"><BarChart2 className="w-6 h-6 text-brand-600"/>Score Entry</h1>
          <p className="page-subtitle">{currentSession?.name} · Select a subject to enter scores</p>
        </div>
        {/* Term switcher */}
        <div className="flex gap-1">
          {(["FIRST","SECOND","THIRD"] as Term[]).map(t => (
            <Link key={t} href={`/teacher/results?term=${t}`}
              className={`btn-sm ${term===t ? "btn-primary" : "btn-secondary"}`}>
              {t === "FIRST" ? "1st" : t === "SECOND" ? "2nd" : "3rd"} Term
            </Link>
          ))}
        </div>
      </div>

      {assignments.length === 0 && (
        <div className="card card-body text-center py-12 text-muted text-sm">
          <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
          No subjects are available for your assigned class. Contact the administrator.
        </div>
      )}

      <div className="space-y-3">
        {assignments.map(a => {
          const key    = `${a.classId}:${a.subjectId}`;
          const counts = statusMap.get(key) ?? {};
          const total  = Object.values(counts).reduce((s, n) => s + n, 0);
          const hasLocked    = (counts["LOCKED"]    ?? 0) > 0;
          const hasSubmitted = (counts["SUBMITTED"] ?? 0) > 0;
          const topStatus    = hasLocked ? "LOCKED" : hasSubmitted ? "SUBMITTED" : total > 0 ? "DRAFT" : "EMPTY";

          return (
            <Link key={a.id} href={`/teacher/results/${a.classId}/${a.subjectId}?term=${term}&sessionId=${currentSession?.id ?? ""}`}
              className="card card-body flex items-center justify-between gap-4 hover:shadow-md hover:border-brand-200 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold text-purple-600">
                  {a.subject.code}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{a.subject.name}</h3>
                  <p className="text-xs text-muted mt-0.5">{a.class.name} {a.class.arm}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-muted">Scores entered</div>
                  <div className="font-semibold text-ink text-sm">{total}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={topStatus}/>
                  <span className={`badge ${topStatus==="LOCKED"?"badge-green":topStatus==="SUBMITTED"?"badge-blue":topStatus==="DRAFT"?"badge-yellow":"badge-gray"} text-xs`}>
                    {topStatus === "EMPTY" ? "Not started" : topStatus.charAt(0) + topStatus.slice(1).toLowerCase()}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted"/>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
