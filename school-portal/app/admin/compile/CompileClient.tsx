"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BarChart2, Lock, Play, Loader2, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { compileClassResults } from "@/actions/results/compileResults";
import { Toast, ConfirmModal } from "@/components/ui";
import type { Term } from "@/types";
import { TERM_LABELS } from "@/types";

interface Props {
  classes:  {
    id:string;
    name:string;
    arm:string;
    sessionId:string;
    subjectAssignments:{ subject:{ id:string; name:string; code:string; isActive:boolean } }[];
  }[];
  sessions: { id:string; name:string; isCurrent:boolean }[];
}

const EARLY_YEARS_ORDER = new Map([
  ["Angel/Creche", 0],
  ["Rainbow", 1],
  ["Glorious Star", 2],
  ["Bright Star", 3],
  ["Lavender", 4],
]);
const ARM_ORDER = new Map([
  ["A", 0],
  ["E", 1],
  ["F", 2],
  ["Pearl", 3],
  ["Ruby", 4],
]);

function compareClasses(
  a: { name:string; arm:string },
  b: { name:string; arm:string }
) {
  const earlyA = EARLY_YEARS_ORDER.get(a.name);
  const earlyB = EARLY_YEARS_ORDER.get(b.name);
  const yearA = Number(a.name.match(/^Year\s+(\d+)$/i)?.[1] ?? Number.NaN);
  const yearB = Number(b.name.match(/^Year\s+(\d+)$/i)?.[1] ?? Number.NaN);
  const orderA = earlyA ?? (Number.isNaN(yearA) ? 10_000 : 100 + yearA);
  const orderB = earlyB ?? (Number.isNaN(yearB) ? 10_000 : 100 + yearB);

  return orderA - orderB
    || a.name.localeCompare(b.name, undefined, { numeric:true })
    || (ARM_ORDER.get(a.arm) ?? 100) - (ARM_ORDER.get(b.arm) ?? 100)
    || a.arm.localeCompare(b.arm, undefined, { numeric:true });
}

export default function CompileClient({ classes, sessions }: Props) {
  const currentSession = sessions.find(s => s.isCurrent) ?? sessions[0];

  const [classId,   setClassId]   = useState(classes[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(currentSession?.id ?? "");
  const [term,      setTerm]      = useState<Term>("FIRST");
  const [lockAfter, setLock]      = useState(false);
  const [showConfirm, setConfirm] = useState(false);
  const [result,    setResult]    = useState<any>(null);
  const [toast,     setToast]     = useState<any>(null);
  const [isPending, start]        = useTransition();
  const sessionClasses = useMemo(
    () => classes
      .filter(schoolClass => schoolClass.sessionId === sessionId)
      .sort(compareClasses),
    [classes, sessionId]
  );
  const selectedClass = sessionClasses.find(schoolClass => schoolClass.id === classId);
  const classSubjects = useMemo(() => {
    const unique = new Map<string, { id:string; name:string; code:string }>();
    for (const assignment of selectedClass?.subjectAssignments ?? []) {
      if (assignment.subject.isActive) unique.set(assignment.subject.id, assignment.subject);
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClass]);

  useEffect(() => {
    if (!sessionClasses.some(schoolClass => schoolClass.id === classId)) {
      setClassId(sessionClasses[0]?.id ?? "");
    }
  }, [classId, sessionClasses]);

  const handleCompile = () => {
    start(async () => {
      const res = await compileClassResults({ classId, sessionId, term, lockAfter });
      setResult(res);
      setToast({ type: res.success ? "success" : "error", message: res.message });
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-brand-600"/> Compile Results
        </h1>
        <p className="page-subtitle">Calculate grades, averages, and class rankings</p>
      </div>

      <div className="card card-body space-y-4">
        <h2 className="section-title">Compilation Parameters</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Class</label>
            <div className="relative">
              <select value={classId} onChange={e => setClassId(e.target.value)} className="input appearance-none pr-8">
                {sessionClasses.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Academic Session</label>
            <div className="relative">
              <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="input appearance-none pr-8">
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}{s.isCurrent?" (current)":""}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Term</label>
            <div className="relative">
              <select value={term} onChange={e => setTerm(e.target.value as Term)} className="input appearance-none pr-8">
                {(Object.entries(TERM_LABELS) as [Term,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Subjects offered by this class</p>
            <span className="badge-blue">{classSubjects.length} subjects</span>
          </div>
          {classSubjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {classSubjects.map(subject => (
                <span key={subject.id} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-ink">
                  {subject.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No subjects are assigned to this class yet.</p>
          )}
        </div>

        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-slate-50">
          <button
            type="button"
            onClick={() => setLock(p => !p)}
            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${lockAfter ? "bg-red-500" : "bg-slate-200"}`}>
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${lockAfter ? "translate-x-5" : ""}`}/>
          </button>
          <div>
            <div className="text-sm font-medium text-ink flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-red-500"/> Lock results after compilation
            </div>
            <div className="text-xs text-muted">Once locked, no teacher can edit scores. Only Super Admin can unlock.</div>
          </div>
        </label>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => lockAfter ? setConfirm(true) : handleCompile()}
            disabled={isPending || !classId || !sessionId}
            className={`${lockAfter ? "btn-danger" : "btn-primary"} gap-2`}>
            {isPending
              ? <><Loader2 className="w-4 h-4 animate-spin"/>Compiling…</>
              : <><Play className="w-4 h-4"/>{lockAfter ? "Compile & Lock" : "Compile Results"}</>}
          </button>
        </div>
      </div>

      {/* Result output */}
      {result && (
        <div className={`card card-body space-y-4 border-2 ${result.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            {result.success
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600"/>
              : <AlertTriangle className="w-5 h-5 text-red-600"/>}
            <p className={`font-semibold text-sm ${result.success ? "text-emerald-800" : "text-red-800"}`}>
              {result.message}
            </p>
          </div>

          {result.success && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Students Ranked",  result.stats.studentsProcessed],
                ["Subjects",         result.stats.subjectsProcessed],
                ["Class Average",    `${result.stats.classAverage}%`],
                ["Pass Rate",        `${result.stats.passRate}%`],
              ].map(([label, value]) => (
                <div key={label} className="bg-white rounded-xl p-3 border border-emerald-200 text-center">
                  <div className="font-display text-xl font-bold text-ink">{value}</div>
                  <div className="text-xs text-muted mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {result.stats?.topStudent && (
            <p className="text-sm text-emerald-800">
              🏆 Top student: <strong>{result.stats.topStudent.name}</strong> — {result.stats.topStudent.average}%
            </p>
          )}

          {result.errors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
              <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          title="Lock Results After Compilation?"
          message="This will compile grades and rankings, then permanently lock all results. Teachers will no longer be able to edit scores. Only Super Admin can reverse this action."
          confirmLabel="Yes, Compile & Lock"
          danger
          onConfirm={() => { setConfirm(false); handleCompile(); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
