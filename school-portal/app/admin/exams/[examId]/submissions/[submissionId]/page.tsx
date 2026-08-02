import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GradingForm from "./GradingForm";

export default async function SubmissionReviewPage({ params }: { params: Promise<{ examId: string; submissionId: string }> }) {
  const { examId, submissionId } = await params;
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "PRIMARY_HEAD", "PRINCIPAL"].includes(session.user.role)) redirect("/auth/signin");
  const submission = await prisma.cBTSubmission.findFirst({
    where: { id: submissionId, examId },
    include: {
      exam: true, student: true, applicant: true,
      answers: { include: { question: true }, orderBy: { question: { order: "asc" } } },
    },
  });
  if (!submission) notFound();
  const candidate = submission.student ?? submission.applicant;
  return <div className="space-y-6">
    <div><Link href={`/admin/exams/${examId}`} className="text-sm text-brand-600">← Exam results</Link><h1 className="page-title mt-2">Submission review</h1><p className="page-subtitle">{candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown candidate"} · Attempt #{submission.attemptNumber} · {submission.gradingStatus.replaceAll("_", " ")}</p></div>
    {submission.answers.map((answer, index) => <div key={answer.id} className="card card-body">
      <div className="flex justify-between gap-4"><h2 className="font-medium">{index + 1}. {answer.question.text}</h2><span className="text-sm font-semibold">{answer.marksAwarded}/{answer.question.marks}</span></div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">{answer.value || "No answer"}</div>
      {["ESSAY", "SHORT_ANSWER"].includes(answer.question.type) && <GradingForm submissionId={submission.id} answerId={answer.id} maximum={answer.question.marks} initialMarks={answer.marksAwarded} initialFeedback={answer.feedback ?? ""}/>} 
    </div>)}
  </div>;
}
