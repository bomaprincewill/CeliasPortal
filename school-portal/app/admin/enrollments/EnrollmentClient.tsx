"use client";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, GraduationCap, Loader2, X } from "lucide-react";
import { changeStudentLifecycle, promoteStudents } from "@/actions/students/manageEnrollment";
import { Toast } from "@/components/ui";

type Student = { id: string; studentId: string; firstName: string; lastName: string };
type ClassItem = { id: string; name: string; arm: string; sessionId: string; capacity: number; session: { name: string }; students: Student[]; _count: { students: number } };
type LifecycleStatus = "TRANSFERRED" | "WITHDRAWN" | "GRADUATED";

export default function EnrollmentClient({ classes }: { classes: ClassItem[] }) {
  const [sourceId, setSource] = useState(classes[0]?.id ?? "");
  const [targetId, setTarget] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<any>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<{ student: Student; status: LifecycleStatus } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [pending, startTransition] = useTransition();
  const source = useMemo(() => classes.find(item => item.id === sourceId), [classes, sourceId]);
  const targets = classes.filter(item => item.id !== sourceId && item.sessionId !== source?.sessionId);
  const toggleAll = () => setSelected(selected.length === source?.students.length ? [] : source?.students.map(item => item.id) ?? []);
  const promote = () => startTransition(async () => {
    const result = await promoteStudents({ sourceClassId: sourceId, targetClassId: targetId, studentIds: selected });
    if (!result.success) return setToast({ type: "error", message: result.error ?? "Promotion failed." });
    setToast({ type: "success", message: `${result.count} student(s) promoted. Refreshing…` });
    window.location.reload();
  });
  const openLifecycleModal = (student: Student, status: LifecycleStatus) => {
    setLifecycleReason("");
    setLifecycleError("");
    setLifecycleTarget({ student, status });
  };
  const closeLifecycleModal = () => {
    if (pending) return;
    setLifecycleTarget(null);
    setLifecycleReason("");
    setLifecycleError("");
  };
  const endEnrollment = () => {
    if (!lifecycleTarget) return;
    const reason = lifecycleReason.trim();
    if (!reason) return setLifecycleError("Enter a reason before continuing.");
    setLifecycleError("");
    startTransition(async () => {
      const result = await changeStudentLifecycle(lifecycleTarget.student.id, lifecycleTarget.status, reason);
      if (!result.success) {
        setLifecycleError(result.error ?? "Student record could not be updated.");
        return;
      }
      setLifecycleTarget(null);
      setToast({ type: "success", message: `${lifecycleTarget.student.firstName} was marked ${lifecycleTarget.status.toLowerCase()}.` });
      window.location.reload();
    });
  };
  return <div className="space-y-6">
    {toast && <Toast {...toast} onClose={() => setToast(null)}/>}<div><h1 className="page-title">Student Enrollments</h1><p className="page-subtitle">Promote students and retain their complete class history.</p></div>
    <div className="card card-body grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
      <div className="form-group"><label className="label">Source class</label><select className="input" value={sourceId} onChange={e => { setSource(e.target.value); setTarget(""); setSelected([]); }}>{classes.map(item => <option key={item.id} value={item.id}>{item.session.name} · {item.name} {item.arm}</option>)}</select></div>
      <ArrowRight className="hidden mb-2 text-muted md:block"/>
      <div className="form-group"><label className="label">Destination class</label><select className="input" value={targetId} onChange={e => setTarget(e.target.value)}><option value="">Select destination…</option>{targets.map(item => <option key={item.id} value={item.id}>{item.session.name} · {item.name} {item.arm} ({item._count.students}/{item.capacity})</option>)}</select></div>
    </div>
    <div className="table-container"><table className="data-table"><thead><tr><th><input type="checkbox" checked={Boolean(source?.students.length) && selected.length === source?.students.length} onChange={toggleAll}/></th><th>Student ID</th><th>Name</th><th className="text-right">Lifecycle</th></tr></thead><tbody>
      {source?.students.map(student => <tr key={student.id}><td><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])}/></td><td className="font-mono text-xs">{student.studentId}</td><td>{student.lastName}, {student.firstName}</td><td className="text-right space-x-1"><button onClick={() => openLifecycleModal(student, "TRANSFERRED")} className="btn-ghost btn-sm">Transfer</button><button onClick={() => openLifecycleModal(student, "WITHDRAWN")} className="btn-ghost btn-sm text-danger">Withdraw</button><button onClick={() => openLifecycleModal(student, "GRADUATED")} className="btn-ghost btn-sm text-emerald-700"><GraduationCap className="h-3.5 w-3.5"/>Graduate</button></td></tr>)}
      {!source?.students.length && <tr><td colSpan={4} className="py-10 text-center text-muted">No active students in this class.</td></tr>}
    </tbody></table></div>
    <button disabled={pending || !targetId || !selected.length} onClick={promote} className="btn-primary gap-2">{pending && <Loader2 className="h-4 w-4 animate-spin"/>}Promote {selected.length || "selected"} student(s)</button>
    {lifecycleTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="lifecycle-modal-title">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="lifecycle-modal-title" className="font-display text-xl font-bold text-ink">{lifecycleTarget.status === "WITHDRAWN" ? "Withdraw student" : lifecycleTarget.status === "TRANSFERRED" ? "Transfer student" : "Graduate student"}</h2>
              <p className="mt-1 text-sm text-muted">{lifecycleTarget.student.firstName} {lifecycleTarget.student.lastName} · {lifecycleTarget.student.studentId}</p>
            </div>
            <button type="button" onClick={closeLifecycleModal} disabled={pending} className="btn-ghost p-2" aria-label="Close"><X className="h-4 w-4"/></button>
          </div>
          <div className="form-group mt-5">
            <label htmlFor="lifecycle-reason" className="label">Reason *</label>
            <textarea id="lifecycle-reason" className="input min-h-28 resize-y" value={lifecycleReason} onChange={event => setLifecycleReason(event.target.value)} placeholder="Enter the reason for this change" autoFocus disabled={pending}/>
          </div>
          {lifecycleError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{lifecycleError}</p>}
          <p className="mt-4 text-xs text-muted">This removes the student from their active class but preserves their enrollment history.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={closeLifecycleModal} disabled={pending} className="btn-secondary justify-center">Cancel</button>
            <button type="button" onClick={endEnrollment} disabled={pending || !lifecycleReason.trim()} className={lifecycleTarget.status === "WITHDRAWN" ? "btn-danger justify-center" : "btn-primary justify-center"}>{pending && <Loader2 className="h-4 w-4 animate-spin"/>}{pending ? "Saving..." : "Confirm"}</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
