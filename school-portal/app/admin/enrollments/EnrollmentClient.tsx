"use client";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, GraduationCap, Loader2 } from "lucide-react";
import { changeStudentLifecycle, promoteStudents } from "@/actions/students/manageEnrollment";
import { Toast } from "@/components/ui";

type Student = { id: string; studentId: string; firstName: string; lastName: string };
type ClassItem = { id: string; name: string; arm: string; sessionId: string; capacity: number; session: { name: string }; students: Student[]; _count: { students: number } };

export default function EnrollmentClient({ classes }: { classes: ClassItem[] }) {
  const [sourceId, setSource] = useState(classes[0]?.id ?? "");
  const [targetId, setTarget] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<any>(null);
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
  const endEnrollment = (student: Student, status: "TRANSFERRED" | "WITHDRAWN" | "GRADUATED") => {
    const reason = window.prompt(`Reason for marking ${student.firstName} ${status.toLowerCase()}:`);
    if (!reason) return;
    startTransition(async () => {
      const result = await changeStudentLifecycle(student.id, status, reason);
      if (!result.success) return setToast({ type: "error", message: result.error ?? "Student record could not be updated." });
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
      {source?.students.map(student => <tr key={student.id}><td><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])}/></td><td className="font-mono text-xs">{student.studentId}</td><td>{student.lastName}, {student.firstName}</td><td className="text-right space-x-1"><button onClick={() => endEnrollment(student, "TRANSFERRED")} className="btn-ghost btn-sm">Transfer</button><button onClick={() => endEnrollment(student, "WITHDRAWN")} className="btn-ghost btn-sm text-danger">Withdraw</button><button onClick={() => endEnrollment(student, "GRADUATED")} className="btn-ghost btn-sm text-emerald-700"><GraduationCap className="h-3.5 w-3.5"/>Graduate</button></td></tr>)}
      {!source?.students.length && <tr><td colSpan={4} className="py-10 text-center text-muted">No active students in this class.</td></tr>}
    </tbody></table></div>
    <button disabled={pending || !targetId || !selected.length} onClick={promote} className="btn-primary gap-2">{pending && <Loader2 className="h-4 w-4 animate-spin"/>}Promote {selected.length || "selected"} student(s)</button>
  </div>;
}
