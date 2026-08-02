"use client";

import { useEffect, useState } from "react";
import ExamRunner from "@/components/cbt/ExamRunner";
import { submitCBTExam } from "@/actions/cbt/submitExam";

export default function StudentExamClient({ examId }: { examId: string }) {
  const [exam, setExam] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/cbt/exam/${examId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load exam.");
        setExam(data);
      })
      .catch((reason) => setError(reason.message));
  }, [examId]);

  if (error) return <div className="card card-body text-center text-red-600">{error}</div>;
  if (!exam) return <div className="card card-body text-center text-muted">Loading exam…</div>;

  return (
    <ExamRunner
      examId={exam.id}
      title={exam.title}
      durationMins={exam.durationMinutes}
      passMark={exam.passMark}
      instructions={exam.instructions ?? "Read every question carefully."}
      questions={exam.questions}
      showResultImmediately={exam.showResultImmediately}
      submissionId={exam.submissionId}
      onSubmit={(answers) => submitCBTExam({ examId: exam.id, submissionId: exam.submissionId, answers })}
    />
  );
}
