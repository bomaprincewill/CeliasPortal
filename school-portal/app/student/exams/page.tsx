import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StudentExamsPage() {
  const session = await getSession();
  if (!session || session.user.role !== "STUDENT") redirect("/auth/signin");

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, classId: true, class: { select: { name: true, arm: true } } },
  });
  if (!student?.classId) {
    return <div className="card card-body py-12 text-center text-muted">Your account is not assigned to a class.</div>;
  }

  const exams = await prisma.exam.findMany({
    where: { classId: student.classId, type: { not: "ENTRANCE" }, isPublished: true },
    orderBy: { scheduledStart: "asc" },
    include: {
      _count: { select: { questions: true } },
      submissions: {
        where: { studentId: student.id, submittedAt: { not: null } },
        select: { percentage: true },
        take: 1,
      },
    },
  });
  const subjects = await prisma.subject.findMany({
    where: { id: { in: exams.flatMap((exam) => exam.subjectId ? [exam.subjectId] : []) } },
    select: { id: true, name: true },
  });
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My CBT Exams</h1>
        <p className="page-subtitle">{student.class?.name} {student.class?.arm} · Exams assigned to your class</p>
      </div>
      {exams.length === 0 ? (
        <div className="card card-body py-12 text-center text-muted">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          No CBT exams have been assigned to your class.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((exam) => {
            const submission = exam.submissions[0];
            const isOpen = now >= exam.scheduledStart && now <= exam.scheduledEnd;
            return (
              <div key={exam.id} className="card card-body">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-ink">{exam.title}</h2>
                    <p className="mt-1 text-xs text-muted">{(exam.subjectId && subjectNames.get(exam.subjectId)) || "General CBT"} · {exam._count.questions} questions</p>
                  </div>
                  <span className={submission ? "badge-green" : isOpen ? "badge-blue" : "badge-gray"}>
                    {submission ? "Completed" : isOpen ? "Available" : now < exam.scheduledStart ? "Upcoming" : "Closed"}
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted">{exam.scheduledStart.toLocaleString()} – {exam.scheduledEnd.toLocaleString()}</p>
                {submission ? (
                  <p className="mt-3 text-sm font-medium text-ink">Score: {submission.percentage?.toFixed(0)}%</p>
                ) : isOpen ? (
                  <Link href={`/student/exams/${exam.id}`} className="btn-primary btn-sm mt-4 w-full justify-center">Start Exam</Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
