"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, CheckCircle2, Clock, AlertTriangle, ChevronDown, BarChart2, Upload } from "lucide-react";
import { Toast, ConfirmModal } from "@/components/ui";
import { approveResults, lockResultsBatch } from "@/actions/results/reviewResults";
import { TERM_LABELS } from "@/types";
import type { Term } from "@/types";

const STATUS_CONFIG = {
  DRAFT:     { label:"Draft",     color:"badge-gray",   icon:Clock },
  SUBMITTED: { label:"Submitted", color:"badge-yellow", icon:AlertTriangle },
  APPROVED:  { label:"Approved",  color:"badge-blue",   icon:CheckCircle2 },
  LOCKED:    { label:"Locked",    color:"badge-green",  icon:Lock },
};

export default function ResultsAdminClient({ classes, subjects, resultGroups, sessionId, sessionName, initialTerm, initialClassId, sessions, canLock, uploadMode = false }: {
  classes: any[]; subjects: any[]; resultGroups: any[];
  sessionId: string; sessionName: string; initialTerm: string; initialClassId: string; uploadMode?: boolean;
  sessions: { id: string; name: string }[]; canLock: boolean;
}) {
  const term = initialTerm as Term;
  const classId = initialClassId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subjectId, setSubjectId] = useState("");
  const [toast, setToast]       = useState<any>(null);
  const [lockTarget, setLock]   = useState<any>(null);
  const [isPending, start]      = useTransition();
  const navigate = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    if (name === "sessionId") params.delete("classId");
    start(() => router.push(`/admin/results?${params.toString()}`));
  };

  // Filter groups by current filters
  const filtered = resultGroups.filter(g =>
    (!classId || g.classId === classId) && (!subjectId || g.subjectId === subjectId) && g.term === term
  );

  // Build summary table: class × subject → status counts
  const byClassSubject = new Map<string, { classId:string; subjectId:string; counts: Record<string,number> }>();
  for (const g of filtered) {
    const key = `${g.classId}:${g.subjectId}`;
    if (!byClassSubject.has(key)) byClassSubject.set(key, { classId:g.classId, subjectId:g.subjectId, counts:{} });
    byClassSubject.get(key)!.counts[g.status] = (byClassSubject.get(key)!.counts[g.status] ?? 0) + g._count.id;
  }
  const rows = [...byClassSubject.values()];

  const handleApprove = (classId: string, subjectId: string) => {
    start(async () => {
      try {
        const result = await approveResults({ classId, subjectId, sessionId, term });
        setToast({ type: result.success ? "success" : "error", message: result.message });
        if (result.success) router.refresh();
      } catch { setToast({ type: "error", message: "Unable to approve results." }); }
    });
  };

  const handleLockBatch = (classId: string, subjectId: string) => {
    setLock({ classId, subjectId });
  };

  const confirmLock = () => {
    if (!lockTarget || isPending) return;
    start(async () => {
      try {
        const result = await lockResultsBatch({ ...lockTarget, sessionId, term });
        setToast({ type: result.success ? "success" : "error", message: result.message });
        if (result.success) { setLock(null); router.refresh(); }
      } catch { setToast({ type: "error", message: "Unable to lock results." }); }
    });
  };

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><BarChart2 className="w-6 h-6 text-brand-600"/>{uploadMode ? "Bulk Upload Results" : "Results Overview"}</h1>
        <p className="page-subtitle">{uploadMode ? "Choose the session, class, and any subject to open the Excel broadsheet uploader." : `${sessionName} — Manage and approve subject scores`}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select aria-label="Academic session" value={sessionId} disabled={isPending} onChange={e => navigate("sessionId", e.target.value)} className="input sm:w-auto">
          {sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="relative w-full sm:w-auto">
          <select aria-label="Academic term" value={term} disabled={isPending} onChange={e => navigate("term", e.target.value)} className="input appearance-none pr-8 sm:min-w-36">
            {(Object.entries(TERM_LABELS) as [Term,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
        </div>
        <div className="relative w-full sm:w-auto">
          <select aria-label="Class" value={classId} disabled={isPending} onChange={e => navigate("classId", e.target.value)} className="input appearance-none pr-8 sm:min-w-40">
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
        </div>
        <div className="relative w-full sm:w-auto">
          <select aria-label="Subject" value={subjectId} disabled={isPending} onChange={e => setSubjectId(e.target.value)} className="input appearance-none pr-8 sm:min-w-52">
            <option value="">Select a subject to upload</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
        </div>
        {classId && subjectId && subjects.find(subject => subject.id === subjectId)?.isActive ? (
          <Link
            href={`/teacher/results/${classId}/${subjectId}?term=${term}&sessionId=${sessionId}`}
            className="btn-primary gap-2"
          >
            <Upload className="h-4 w-4"/> Upload scores
          </Link>
        ) : (
          <span className="btn-secondary cursor-not-allowed opacity-60">Select class and subject</span>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon;
          const count = filtered.filter(g => g.status === status).reduce((sum,g) => sum + g._count.id, 0);
          return (
            <div key={status} className="card card-body py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-muted"/>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-ink">{count}</div>
                <div className="text-xs text-muted">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th><th>Subject</th>
              <th className="text-center">Draft</th>
              <th className="text-center">Submitted</th>
              <th className="text-center">Approved</th>
              <th className="text-center">Locked</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-muted">No results found for selected filters.</td></tr>
            )}
            {rows.map(row => {
              const cls = classes.find(c => c.id === row.classId);
              const sub = subjects.find(s => s.id === row.subjectId);
              const hasSubmitted = (row.counts["SUBMITTED"] ?? 0) > 0;
              const hasApproved  = (row.counts["APPROVED"]  ?? 0) > 0;
              const allLocked    = (row.counts["LOCKED"]    ?? 0) > 0 && !hasSubmitted && !hasApproved && !(row.counts["DRAFT"] ?? 0);

              return (
                <tr key={`${row.classId}:${row.subjectId}`}>
                  <td className="font-medium">{cls?.name} {cls?.arm}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="badge-gray font-mono text-xs">{sub?.code}</span>
                      {sub?.name}
                    </div>
                  </td>
                  <td className="text-center text-muted">{row.counts["DRAFT"] ?? 0}</td>
                  <td className="text-center">
                    {(row.counts["SUBMITTED"] ?? 0) > 0
                      ? <span className="badge-yellow">{row.counts["SUBMITTED"]}</span>
                      : <span className="text-muted">0</span>}
                  </td>
                  <td className="text-center">
                    {(row.counts["APPROVED"] ?? 0) > 0
                      ? <span className="badge-blue">{row.counts["APPROVED"]}</span>
                      : <span className="text-muted">0</span>}
                  </td>
                  <td className="text-center">
                    {(row.counts["LOCKED"] ?? 0) > 0
                      ? <span className="badge-green">{row.counts["LOCKED"]}</span>
                      : <span className="text-muted">0</span>}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/compile?classId=${row.classId}&sessionId=${sessionId}&term=${term}`} className="btn-secondary btn-sm">Compile</Link>
                      {hasSubmitted && (
                        <button onClick={() => handleApprove(row.classId, row.subjectId)} disabled={isPending}
                          className="btn-success btn-sm gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5"/> Approve
                        </button>
                      )}
                      {canLock && hasApproved && !allLocked && (
                        <button onClick={() => handleLockBatch(row.classId, row.subjectId)} disabled={isPending}
                          className="btn-warn btn-sm gap-1">
                          <Lock className="w-3.5 h-3.5"/> Lock
                        </button>
                      )}
                      {allLocked && <span className="badge-green">🔒 Locked</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lockTarget && (
        <ConfirmModal
          title="Lock Results?"
          message={`This will permanently lock all approved results for this subject in ${classes.find(c=>c.id===lockTarget.classId)?.name}. Teachers will no longer be able to edit scores.`}
          confirmLabel="Lock Results" danger
          onConfirm={confirmLock}
          onCancel={() => setLock(null)}
        />
      )}
    </div>
  );
}
