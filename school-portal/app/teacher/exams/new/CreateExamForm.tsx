"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload } from "lucide-react";
import { createCBTExamFromWord } from "@/actions/cbt/createExam";

interface Option { id: string; name: string; arm?: string }

export default function CreateExamForm({
  sessions,
  classes,
  subjects,
}: {
  sessions: (Option & { isCurrent: boolean })[];
  classes: Option[];
  subjects: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  if (classes.length === 0) {
    return (
      <div className="card card-body py-10 text-center">
        <h2 className="font-semibold text-ink">No assigned classes</h2>
        <p className="mt-1 text-sm text-muted">
          An administrator must assign a class to your teacher profile before you can create a CBT exam.
        </p>
      </div>
    );
  }

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createCBTExamFromWord(formData);
      if (!result.success) {
        setMessage({ type: "error", text: result.message });
        return;
      }
      setMessage({ type: "success", text: result.message });
      router.push("/teacher/exams");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <section className="card card-body space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Exam details</h2>
          <p className="text-xs text-muted">Only classes and subjects assigned to your teacher profile are available.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="form-group sm:col-span-2">
            <label className="label" htmlFor="title">Exam title *</label>
            <input id="title" name="title" className="input" required placeholder="e.g. First Term Maths CBT" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="sessionId">Academic session *</label>
            <select id="sessionId" name="sessionId" className="input" required defaultValue={sessions.find((item) => item.isCurrent)?.id}>
              {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="term">Term</label>
            <select id="term" name="term" className="input">
              <option value="FIRST">First term</option>
              <option value="SECOND">Second term</option>
              <option value="THIRD">Third term</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="classId">Receiving class *</label>
            <select id="classId" name="classId" className="input" required defaultValue="">
              <option value="" disabled>Select a class</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name} {item.arm}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="subjectId">Subject (optional)</label>
            <select id="subjectId" name="subjectId" className="input">
              <option value="">General / unassigned</option>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="durationMinutes">Duration (minutes)</label>
            <input id="durationMinutes" name="durationMinutes" type="number" min="1" max="480" defaultValue="60" className="input" required />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="passMark">Pass mark (%)</label>
            <input id="passMark" name="passMark" type="number" min="0" max="100" defaultValue="50" className="input" required />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="scheduledStart">Starts *</label>
            <input id="scheduledStart" name="scheduledStart" type="datetime-local" className="input" required />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="scheduledEnd">Ends *</label>
            <input id="scheduledEnd" name="scheduledEnd" type="datetime-local" className="input" required />
          </div>
          <div className="form-group sm:col-span-2">
            <label className="label" htmlFor="instructions">Instructions</label>
            <textarea id="instructions" name="instructions" className="input min-h-24" placeholder="Instructions shown before the exam starts" />
          </div>
        </div>
      </section>

      <section className="card card-body space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5"><FileText className="h-5 w-5 text-brand-600" /></div>
          <div>
            <h2 className="font-semibold text-ink">Upload questions from Word</h2>
            <p className="text-xs text-muted">Upload a `.docx` file, maximum 10 MB.</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-slate-50 p-4 text-xs text-ink">
          <p className="mb-2 font-semibold">Required document format</p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono leading-5">{`1. What is 2 + 2?
A. 3
B. 4
C. 5
D. 6
Answer: B
Marks: 1
Explanation: Two plus two equals four.`}</pre>
        </div>
        <input name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input py-2" required />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input name="isPublished" type="checkbox" className="h-4 w-4 rounded border-border" />
          Publish immediately
        </label>
      </section>

      {message && (
        <div className={message.type === "error" ? "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" : "rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"}>
          {message.text}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full justify-center sm:w-auto">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {pending ? "Importing Word document…" : "Create CBT Exam"}
      </button>
    </form>
  );
}
