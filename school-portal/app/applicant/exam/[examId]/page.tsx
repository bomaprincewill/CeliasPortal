"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ExamRunner from "@/components/cbt/ExamRunner";
import { submitCBTExam } from "@/actions/cbt/submitExam";
import { Loader2 } from "lucide-react";

interface ExamData {
  id: string; title: string; durationMinutes: number; passMark: number;
  instructions: string; showResultImmediately: boolean;
  questions: { id:string; type:any; text:string; marks:number; options?:{ id:string; text:string }[]; wordLimit?:number }[];
  applicantId: string;
  submissionId: string;
}

export default function ApplicantExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [exam, setExam]     = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!session) return;
    fetch(`/api/cbt/exam/${examId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); } else { setExam(data); }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load exam."); setLoading(false); });
  }, [examId, session]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600"/>
    </div>
  );

  if (error) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-red-600 font-medium">{error}</p>
      <button onClick={() => router.push("/applicant/dashboard")} className="btn-secondary">← Back to Dashboard</button>
    </div>
  );

  if (!exam) return null;

  const handleSubmit = async (answers: Record<string,string>) => {
    const result = await submitCBTExam({
      examId: exam.id,
      submissionId: exam.submissionId,
      answers,
      isApplicant: true,
      applicantId: exam.applicantId,
    });
    return result;
  };

  return (
    <ExamRunner
      examId={exam.id}
      title={exam.title}
      durationMins={exam.durationMinutes}
      passMark={exam.passMark}
      instructions={exam.instructions ?? "Read each question carefully before answering."}
      questions={exam.questions}
      showResultImmediately={exam.showResultImmediately}
      submissionId={exam.submissionId}
      onSubmit={handleSubmit}
    />
  );
}
