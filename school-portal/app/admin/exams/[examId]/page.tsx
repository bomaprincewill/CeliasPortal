import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Trophy, Users, XCircle } from "lucide-react";
import ExamControls from "./ExamControls";

export default async function AdminCBTResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  if (session.user.role === "NURSERY_HEAD") redirect("/admin/dashboard");
  const level = getLeadershipLevel(session.user.role);

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      ...(level ? { class: { level: { equals: level, mode: "insensitive" as const } } } : {}),
    },
    include: {
      class: { select: { name: true, arm: true } },
      submissions: {
        orderBy: [{ percentage: "desc" }, { submittedAt: "asc" }],
        include: {
          student: { select: { studentId: true, firstName: true, lastName: true } },
          applicant: { select: { applicationNo: true, firstName: true, lastName: true, applyingForClass: true } },
          _count: { select: { answers: true } },
        },
      },
    },
  });
  if (!exam) notFound();

  const completed = exam.submissions.filter((submission) => submission.submittedAt !== null);
  const passed = completed.filter((submission) => submission.isPassed === true).length;
  const failed = completed.filter((submission) => submission.isPassed === false).length;
  const average = completed.length
    ? completed.reduce((sum, submission) => sum + (submission.percentage ?? 0), 0) / completed.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/exams" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to exams
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">{exam.title}</h1>
            <p className="page-subtitle">
              {exam.type === "ENTRANCE" ? "Entrance examination" : `${exam.class?.name ?? "Unassigned"} ${exam.class?.arm ?? ""}`.trim()}
              {` · Pass mark: ${exam.passMark}%`}
            </p>
          </div>
          <span className={exam.isPublished ? "badge-green" : "badge-gray"}>{exam.isPublished ? "Published" : "Draft"}</span>
        </div>
      </div>

      <ExamControls exam={{ id:exam.id,title:exam.title,durationMinutes:exam.durationMinutes,passMark:exam.passMark,maxAttempts:exam.maxAttempts,isPublished:exam.isPublished,showResultImmediately:exam.showResultImmediately }}/>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Submissions", value: completed.length, Icon: Users, color: "text-brand-600" },
          { label: "Passed", value: passed, Icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Failed", value: failed, Icon: XCircle, color: "text-red-600" },
          { label: "Average score", value: `${average.toFixed(1)}%`, Icon: Trophy, color: "text-yellow-600" },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="card card-body flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <div><div className="text-2xl font-bold text-ink">{value}</div><div className="text-xs text-muted">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="table-container">
        {exam.submissions.length === 0 ? (
          <div className="py-14 text-center text-muted">
            <Clock className="mx-auto mb-3 h-10 w-10 text-slate-200" />
            No candidates have submitted this exam yet.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Attempt</th><th>Candidate</th><th>Candidate ID</th><th>Score</th><th>Percentage</th><th>Result</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {exam.submissions.map((submission, index) => {
                const candidate = submission.student ?? submission.applicant;
                const candidateId = submission.student?.studentId ?? submission.applicant?.applicationNo ?? "—";
                const name = candidate ? `${candidate.lastName}, ${candidate.firstName}` : "Unknown candidate";
                const isComplete = submission.submittedAt !== null;
                return (
                  <tr key={submission.id}>
                    <td className="text-xs text-muted">#{submission.attemptNumber}</td>
                    <td className="font-medium">{name}</td>
                    <td className="font-mono text-xs">{candidateId}</td>
                    <td>{isComplete ? `${submission.rawScore ?? 0}/${submission.totalMarks ?? exam.totalMarks}` : "—"}</td>
                    <td className="font-semibold">{isComplete ? `${(submission.percentage ?? 0).toFixed(1)}%` : "—"}</td>
                    <td>
                      {!isComplete ? <span className="badge-yellow">In progress</span> : submission.gradingStatus === "PENDING_MANUAL" ? <span className="badge-yellow">Needs grading</span> : submission.isPassed
                        ? <span className="badge-green">Passed</span>
                        : <span className="badge-red">Failed</span>}
                    </td>
                    <td className="text-xs text-muted">{submission.submittedAt?.toLocaleString() ?? "Not submitted"}</td>
                    <td className="text-right"><Link href={`/admin/exams/${exam.id}/submissions/${submission.id}`} className="btn-ghost btn-sm">Review</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
