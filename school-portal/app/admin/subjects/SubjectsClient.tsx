"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Edit2, Check, Users, GraduationCap, X, UserPlus } from "lucide-react";
import { Toast, ConfirmModal } from "@/components/ui";
import { abbreviateSubjectName } from "@/lib/subjectCode";
import { assignSubjectTeacher, removeSubjectTeacher } from "@/actions/subjects/manageSubjectAssignment";

export default function SubjectsClient({ initialSubjects, classes, teachers }: { initialSubjects: any[]; classes: any[]; teachers: any[] }) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [showForm, setForm]   = useState(false);
  const [editItem, setEdit]   = useState<any>(null);
  const [delItem,  setDel]    = useState<any>(null);
  const [toast, setToast]     = useState<any>(null);
  const [pending, start]      = useTransition();
  const [selected, setSelected] = useState<any>(null);
  const [detailClassId, setDetailClassId] = useState("");
  const [detailTeacherId, setDetailTeacherId] = useState("");

  const [form, setForm2] = useState({ name:"", code:"", description:"", classIds:[] as string[] });
  const [assigns, setAssigns] = useState<{ classId:string; teacherId:string }[]>([]);

  const resetForm = () => { setForm2({ name:"", code:"", description:"", classIds:[] }); setAssigns([]); };

  const toggleClass = (id: string) =>
    setForm2(f => ({ ...f, classIds: f.classIds.includes(id) ? f.classIds.filter(x=>x!==id) : [...f.classIds, id] }));

  const setAssignment = (classId: string, teacherId: string) => {
    setAssigns(prev => {
      const rest = prev.filter(a => a.classId !== classId);
      return teacherId ? [...rest, { classId, teacherId }] : rest;
    });
  };

  const saveStaffAssignment = (classId: string, teacherId: string) => {
    if (!selected || !classId || !teacherId) {
      setToast({ type:"error", message:"Select both a class and a staff member." });
      return;
    }
    start(async () => {
      try {
        const result = await assignSubjectTeacher({ subjectId:selected.id, classId, teacherId });
        const nextAssignments = [...selected.assignments.filter((a:any) => a.classId !== classId), result.assignment];
        const updated = { ...selected, assignments:nextAssignments, _count:{ ...selected._count, assignments:nextAssignments.length } };
        setSelected(updated);
        setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s));
        setDetailClassId(""); setDetailTeacherId("");
        setToast({ type:"success", message:"Subject staff assignment saved." });
      } catch (error) {
        setToast({ type:"error", message:error instanceof Error ? error.message : "Could not save the assignment." });
      }
    });
  };

  const removeStaffAssignment = (assignmentId: string) => {
    if (!selected) return;
    start(async () => {
      try {
        await removeSubjectTeacher(assignmentId);
        const nextAssignments = selected.assignments.filter((a:any) => a.id !== assignmentId);
        const updated = { ...selected, assignments:nextAssignments, _count:{ ...selected._count, assignments:nextAssignments.length } };
        setSelected(updated);
        setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s));
        setToast({ type:"success", message:"Staff member removed from the subject." });
      } catch (error) {
        setToast({ type:"error", message:error instanceof Error ? error.message : "Could not remove the staff member." });
      }
    });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim()) { setToast({ type:"error", message:"Name and code are required." }); return; }
    start(async () => {
      if (editItem) {
        setSubjects(prev => prev.map(s => s.id === editItem.id ? { ...s, ...form } : s));
        setToast({ type:"success", message:"Subject updated." });
      } else {
        const newSubject = { id:`sub_${Date.now()}`, ...form, isActive:true, _count:{ assignments:assigns.length, results:0 }, assignments:[] };
        setSubjects(prev => [...prev, newSubject]);
        setToast({ type:"success", message:"Subject created." });
      }
      setForm(false); setEdit(null); resetForm();
    });
  };

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.filter(s=>s.isActive).length} active subjects</p>
        </div>
        <button onClick={() => { resetForm(); setEdit(null); setForm(true); }} className="btn-primary btn-sm w-full justify-center gap-2 sm:w-auto">
          <Plus className="w-3.5 h-3.5"/> Add Subject
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th><th>Code</th><th>Assignments</th><th>Status</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-muted">No subjects yet.</td></tr>
            )}
            {subjects.map(s => (
              <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer hover:bg-slate-50">
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center font-mono text-xs font-bold text-purple-600 flex-shrink-0">
                      {s.code?.slice(0,3)}
                    </div>
                    <div>
                      <div className="font-medium text-ink">{s.name}</div>
                      {s.description && <div className="text-xs text-muted">{s.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="font-mono text-xs text-muted">{s.code}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {s.assignments?.slice(0,3).map((a: any) => (
                      <span key={a.id} className="badge-gray text-xs">
                        {a.class?.name} {a.class?.arm}
                      </span>
                    ))}
                    {(s._count?.assignments ?? 0) > 3 && (
                      <span className="badge-gray text-xs">+{s._count.assignments - 3}</span>
                    )}
                    {(s._count?.assignments ?? 0) === 0 && <span className="text-xs text-muted">None</span>}
                  </div>
                </td>
                <td>
                  <span className={s.isActive ? "badge-green" : "badge-red"}>{s.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={e => { e.stopPropagation(); setForm2({ name:s.name, code:s.code, description:s.description??"", classIds:[] }); setEdit(s); setForm(true); }} className="btn-ghost btn-icon btn-sm">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDel(s); }} className="btn-ghost btn-icon btn-sm hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (() => {
        const offeredClassIds = new Set<string>(selected.assignments.map((a:any): string => a.classId));
        // Count each class once if legacy data contains more than one teacher assignment.
        const uniqueStudentCount = Array.from(offeredClassIds).reduce<number>((total, classId) => {
          const assignment = selected.assignments.find((a:any) => a.classId === classId);
          return total + (assignment?.class?._count?.students ?? 0);
        }, 0);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl w-full space-y-5 max-h-[90vh] overflow-y-auto slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div><p className="font-mono text-xs text-brand-600">{selected.code}</p><h2 className="font-display font-bold text-xl text-ink">{selected.name}</h2></div>
                <button className="btn-ghost btn-icon" onClick={() => setSelected(null)}><X className="w-5 h-5"/></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-purple-50 p-4"><Users className="w-5 h-5 text-purple-600 mb-2"/><p className="text-2xl font-bold">{selected.assignments.length}</p><p className="text-xs text-muted">Staff assignments</p></div>
                <div className="rounded-xl bg-blue-50 p-4"><GraduationCap className="w-5 h-5 text-blue-600 mb-2"/><p className="text-2xl font-bold">{uniqueStudentCount}</p><p className="text-xs text-muted">Students offering subject</p></div>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Staff in charge</h3>
                <div className="space-y-2">
                  {selected.assignments.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted text-center">No staff member is assigned.</p>}
                  {selected.assignments.map((a:any) => (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border p-3">
                      <div className="flex-1"><p className="font-medium text-sm">{a.teacher?.user?.name}</p><p className="text-xs text-muted">{a.class?.name} {a.class?.arm} · {a.class?._count?.students ?? 0} students</p></div>
                      <select disabled={pending} value={a.teacherId} onChange={e => saveStaffAssignment(a.classId, e.target.value)} className="input text-sm sm:w-52">
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}
                      </select>
                      <button disabled={pending} onClick={() => removeStaffAssignment(a.id)} className="btn-ghost btn-sm text-danger gap-1"><Trash2 className="w-3.5 h-3.5"/> Remove</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4"/> Assign new staff</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select value={detailClassId} onChange={e => setDetailClassId(e.target.value)} className="input text-sm"><option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}</select>
                  <select value={detailTeacherId} onChange={e => setDetailTeacherId(e.target.value)} className="input text-sm"><option value="">Select staff member</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}</select>
                </div>
                <button disabled={pending || !detailClassId || !detailTeacherId} onClick={() => saveStaffAssignment(detailClassId, detailTeacherId)} className="btn-primary btn-sm mt-3 gap-2"><UserPlus className="w-3.5 h-3.5"/>{pending ? "Saving..." : "Assign Staff"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4 slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display font-bold text-xl text-ink">{editItem ? "Edit Subject" : "Add Subject"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Subject Name *</label>
                <input value={form.name} onChange={e => {
                  const name = e.target.value;
                  setForm2(f => ({ ...f, name, code: abbreviateSubjectName(name) }));
                }} className="input" placeholder="e.g. Mathematics"/>
              </div>
              <div className="form-group">
                <label className="label">Code (automatic)</label>
                <input value={form.code} readOnly className="input font-mono bg-slate-50" placeholder="MAT" maxLength={5}/>
              </div>
              <div className="col-span-2 form-group">
                <label className="label">Description</label>
                <input value={form.description} onChange={e => setForm2(f=>({...f,description:e.target.value}))} className="input" placeholder="Optional short description"/>
              </div>
            </div>

            <div>
              <label className="label">Classes that offer this subject</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {classes.map(c => (
                  <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all flex items-center gap-1 ${form.classIds.includes(c.id) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border text-muted hover:border-brand-200"}`}>
                    {form.classIds.includes(c.id) && <Check className="w-3 h-3"/>}
                    {c.name} {c.arm}
                  </button>
                ))}
              </div>
            </div>

            {/* Teacher assignments per class */}
            {form.classIds.length > 0 && (
              <div>
                <label className="label">Assign Teachers</label>
                <div className="space-y-2">
                  {form.classIds.map(cid => {
                    const cls = classes.find(c => c.id === cid);
                    const current = assigns.find(a => a.classId === cid)?.teacherId ?? "";
                    return (
                      <div key={cid} className="flex items-center gap-3">
                        <span className="text-xs text-muted w-24 shrink-0">{cls?.name} {cls?.arm}</span>
                        <select value={current} onChange={e => setAssignment(cid, e.target.value)} className="input text-sm">
                          <option value="">— select teacher —</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">Save</button>
              <button onClick={() => { setForm(false); setEdit(null); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {delItem && (
        <ConfirmModal
          title={`Delete ${delItem.name}?`}
          message="This will remove the subject and all related assignments. Results already entered will not be deleted."
          confirmLabel="Delete Subject" danger
          onConfirm={() => { setSubjects(p=>p.filter(s=>s.id!==delItem.id)); setDel(null); setToast({ type:"success", message:"Subject deleted." }); }}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
