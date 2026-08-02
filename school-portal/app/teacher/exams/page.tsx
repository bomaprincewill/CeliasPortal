import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function TeacherExamsPage() {
  const session = await getSession();
  if (!session || !["FORM_TEACHER", "SUBJECT_TEACHER"].includes(session.user.role)) redirect("/auth/signin");

  const exams = await prisma.exam.findMany({
    where: {
      type: { not: "ENTRANCE" },
      createdById: session.user.id,
    },
    orderBy: { scheduledStart: "desc" },
    include: {
      class: { select: { name: true, arm: true } },
      _count: { select: { questions: true, submissions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">CBT Exams</h1>
          <p className="mt-1 text-sm text-muted">Exams you created for your assigned classes and subjects.</p>
        </div>
        <Link href="/teacher/exams/new" className="btn-primary">Create CBT Exam</Link>
      </div>
      {exams.length === 0 ? (
        <div className="card card-body py-12 text-center text-muted">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          You have not created any CBT exams yet.
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <div key={exam.id} className="card card-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink">{exam.title}</h2>
                <p className="mt-1 text-xs text-muted">
                  {exam.class ? `${exam.class.name} ${exam.class.arm}` : "Class not assigned"} · {exam._count.questions} questions · {exam.durationMinutes} minutes
                </p>
              </div>
              <div className="text-right">
                <span className={exam.isPublished ? "badge-green" : "badge-gray"}>{exam.isPublished ? "Published" : "Draft"}</span>
                <p className="mt-2 text-xs text-muted">{exam._count.submissions} submissions</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
