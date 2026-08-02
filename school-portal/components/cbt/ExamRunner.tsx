"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, AlertTriangle, ChevronLeft, ChevronRight, Send, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/components/ui";
import type { QuestionType } from "@/types";

interface Option { id: string; text: string }
interface Question {
  id: string; type: QuestionType; text: string; marks: number;
  options?: Option[]; imageUrl?: string; wordLimit?: number;
}
interface ExamResult {
  submissionId: string; score: number; total: number; percentage: number; passed: boolean;
  resultReleased?: boolean;
  answers: { questionId:string; isCorrect:boolean|null; marksAwarded:number; correctAnswer?:string; yourAnswer?:string }[];
}

interface Props {
  examId:      string;
  title:       string;
  durationMins: number;
  passMark:    number;
  instructions: string;
  questions:   Question[];
  submissionId?: string;
  showResultImmediately: boolean;
  onSubmit:    (answers: Record<string,string>) => Promise<ExamResult>;
}

export default function ExamRunner({ examId, title, durationMins, passMark, instructions, questions, submissionId, showResultImmediately, onSubmit }: Props) {
  const [phase, setPhase]       = useState<"intro"|"exam"|"result">("intro");
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState<Record<string,string>>({});
  const [timeLeft, setTimeLeft] = useState(durationMins * 60);
  const [confirm, setConfirm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState<ExamResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Timer
  useEffect(() => {
    if (phase !== "exam") return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const handleSubmit = useCallback(async (auto = false) => {
    clearInterval(intervalRef.current);
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await onSubmit(answers);
      setResult(res);
      setPhase("result");
    } catch { alert("Submission failed. Please try again."); }
    finally { setSubmitting(false); }
  }, [answers, onSubmit]);

  const setAnswer = (qId: string, val: string) => setAnswers(p => ({ ...p, [qId]: val }));

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const answered = Object.keys(answers).length;
  const warn = timeLeft < 300;

  const q = questions[current];

  // ── Intro screen ─────────────────────────────────────────────
  if (phase === "intro") return (
    <div className="max-w-xl mx-auto">
      <div className="card card-body space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
          <p className="text-muted text-sm mt-1">Read the instructions carefully before you begin.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[["Questions",questions.length],["Duration",`${durationMins} min`],["Pass Mark",`${passMark}%`]].map(([l,v])=>(
            <div key={l} className="bg-surface rounded-xl p-3 border border-border">
              <div className="font-display text-lg font-bold text-ink">{v}</div>
              <div className="text-xs text-muted mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">Instructions</p>
              <p className="text-sm text-yellow-700">{instructions}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          ⚠ Once started, the timer cannot be paused. Ensure you are ready and in a quiet environment.
        </div>
        <button onClick={()=>setPhase("exam")} className="btn-primary w-full justify-center py-3 text-base">
          Start Exam →
        </button>
      </div>
    </div>
  );

  // ── Result screen ─────────────────────────────────────────────
  if (phase === "result" && result) return (
    <div className="max-w-2xl mx-auto space-y-6">
      {result.resultReleased === false ? (
        <div className="card card-body text-center py-10 border-2 border-brand-200 bg-brand-50">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-600"/>
          <h2 className="font-display text-2xl font-bold text-ink">Exam submitted</h2>
          <p className="text-sm text-muted mt-2">Your result will be released by the school later.</p>
        </div>
      ) : <>
      <div className={cn("card card-body text-center py-8 border-2", result.passed?"border-emerald-200 bg-emerald-50":"border-red-200 bg-red-50")}>
        <div className="text-5xl mb-4">{result.passed?"🎉":"📚"}</div>
        <div className={cn("font-display text-5xl font-bold", result.passed?"text-emerald-600":"text-red-600")}>
          {result.percentage}%
        </div>
        <div className="text-muted text-sm mt-1">{result.score} / {result.total} marks</div>
        <div className={cn("mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold text-sm",result.passed?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700")}>
          {result.passed ? <><CheckCircle2 className="w-4 h-4"/>Passed!</> : <><XCircle className="w-4 h-4"/>Did not pass</>}
        </div>
        <p className="text-xs text-muted mt-2">Pass mark: {passMark}%</p>
      </div>

      {showResultImmediately && (
        <div className="card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-ink">Question Review</h2>
          </div>
          <div className="divide-y divide-border">
            {questions.map((q,i) => {
              const ans = result.answers.find(a=>a.questionId===q.id);
              const Icon = ans?.isCorrect===true ? CheckCircle2 : ans?.isCorrect===false ? XCircle : MinusCircle;
              const iconColor = ans?.isCorrect===true?"text-emerald-500":ans?.isCorrect===false?"text-red-500":"text-muted";
              return (
                <div key={q.id} className="px-5 py-4 flex items-start gap-3">
                  <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", iconColor)}/>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{i+1}. {q.text}</p>
                    <div className="text-xs mt-1.5 space-y-0.5">
                      {ans?.yourAnswer && <p><span className="text-muted">Your answer: </span><span className={ans.isCorrect?"text-emerald-600 font-medium":"text-red-600 font-medium"}>{ans.yourAnswer}</span></p>}
                      {ans?.isCorrect===false && ans?.correctAnswer && <p><span className="text-muted">Correct: </span><span className="text-emerald-600 font-medium">{ans.correctAnswer}</span></p>}
                      {(q.type==="SHORT_ANSWER"||q.type==="ESSAY") && <p className="text-muted italic">Manually reviewed by teacher</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>}
    </div>
  );

  // ── Exam screen ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Timer + progress bar */}
      <div className="card card-body flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{title}</p>
          <p className="text-xs text-muted">Q {current+1} / {questions.length} · {answered} answered</p>
        </div>
        <div className={cn("flex items-center gap-2 font-mono text-lg font-bold rounded-xl px-4 py-2 flex-shrink-0", warn?"bg-red-50 text-danger timer-warning":"bg-brand-50 text-brand-700")}>
          <Clock className="w-4 h-4"/>{fmt(timeLeft)}
        </div>
      </div>

      {/* Navigator */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q,i) => (
            <button key={q.id} onClick={()=>setCurrent(i)}
              className={cn("w-8 h-8 rounded-lg text-xs font-semibold transition-all",
                i===current     ? "bg-brand-600 text-white" :
                answers[q.id]   ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                "bg-slate-100 text-muted hover:bg-slate-200"
              )}>
              {i+1}
            </button>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted">
          <span><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-200 mr-1"/>Answered ({answered})</span>
          <span><span className="inline-block w-3 h-3 rounded bg-slate-100 mr-1"/>Not answered ({questions.length-answered})</span>
        </div>
      </div>

      {/* Question */}
      {q && (
        <div className="card card-body space-y-5">
          <div className="flex items-start gap-3">
            <span className="text-xs font-mono text-muted mt-1 w-8 shrink-0">Q{current+1}.</span>
            <div className="flex-1">
              <p className="text-ink font-medium leading-relaxed">{q.text}</p>
              {q.imageUrl && <img src={q.imageUrl} alt="Question" className="mt-3 max-h-48 rounded-lg border"/>}
              <p className="text-xs text-muted mt-1">{q.marks} mark{q.marks!==1?"s":""}</p>
            </div>
          </div>

          {/* MCQ */}
          {q.type==="MCQ" && q.options && (
            <div className="space-y-2 ml-11">
              {q.options.map((opt,i) => (
                <button key={opt.id} onClick={()=>setAnswer(q.id,opt.id)}
                  className={cn("w-full text-left rounded-xl border-2 px-4 py-3 text-sm flex items-center gap-3 transition-all",
                    answers[q.id]===opt.id
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-border hover:border-brand-200 text-ink"
                  )}>
                  <span className={cn("w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold",
                    answers[q.id]===opt.id?"border-brand-600 bg-brand-600 text-white":"border-slate-300")}>
                    {String.fromCharCode(65+i)}
                  </span>
                  {opt.text}
                </button>
              ))}
            </div>
          )}

          {/* True/False */}
          {q.type==="TRUE_FALSE" && (
            <div className="flex gap-3 ml-11">
              {[["true","✓ True"],["false","✗ False"]].map(([v,l])=>(
                <button key={v} onClick={()=>setAnswer(q.id,v)}
                  className={cn("flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all",
                    answers[q.id]===v?"border-brand-600 bg-brand-50 text-brand-700":"border-border hover:border-brand-200 text-ink")}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Short answer */}
          {q.type==="SHORT_ANSWER" && (
            <div className="ml-11">
              <textarea rows={3} value={answers[q.id]??""} onChange={e=>setAnswer(q.id,e.target.value)}
                placeholder="Type your answer here…" className="input resize-none"/>
            </div>
          )}

          {/* Essay */}
          {q.type==="ESSAY" && (
            <div className="ml-11 space-y-2">
              {q.wordLimit && <p className="text-xs text-muted">Word limit: {q.wordLimit} words</p>}
              <textarea rows={8} value={answers[q.id]??""} onChange={e=>setAnswer(q.id,e.target.value)}
                placeholder="Write your essay here…" className="input resize-none"/>
              <div className="text-xs text-right text-muted">
                {(answers[q.id]??"").trim().split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <button onClick={()=>setCurrent(c=>Math.max(0,c-1))} disabled={current===0} className="btn-secondary gap-2">
          <ChevronLeft className="w-4 h-4"/> Previous
        </button>
        {current < questions.length-1 ? (
          <button onClick={()=>setCurrent(c=>c+1)} className="btn-primary gap-2">
            Next <ChevronRight className="w-4 h-4"/>
          </button>
        ) : (
          <button onClick={()=>setConfirm(true)} disabled={submitting} className="btn-primary gap-2">
            <Send className="w-4 h-4"/> Submit Exam
          </button>
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 slide-up">
            <h2 className="font-display font-bold text-xl text-ink">Submit exam?</h2>
            <p className="text-sm text-muted">
              You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.
              {questions.length-answered>0 && <span className="text-warn font-medium"> {questions.length-answered} unanswered.</span>}
            </p>
            <p className="text-xs text-muted">You cannot change answers after submitting.</p>
            <div className="flex gap-3">
              <button onClick={()=>handleSubmit(false)} disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting?"Submitting…":"Submit"}
              </button>
              <button onClick={()=>setConfirm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
