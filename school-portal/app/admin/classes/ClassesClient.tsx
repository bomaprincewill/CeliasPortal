"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Edit2, School, Users, BookMarked } from "lucide-react";
import { Toast, ConfirmModal, EmptyState } from "@/components/ui";
import { sortClasses } from "@/lib/classSorting";

export default function ClassesClient({ initialClasses, teachers, sessions, canCreateClass = true, learnerLabel = "students" }: { initialClasses: any[]; teachers: any[]; sessions: any[]; canCreateClass?: boolean; learnerLabel?: string }) {
  const [classes, setClasses] = useState(initialClasses);
  const [showForm, setForm]   = useState(false);
  const [editItem, setEdit]   = useState<any>(null);
  const [delItem,  setDel]    = useState<any>(null);
  const [toast, setToast]     = useState<any>(null);
  const [, start]             = useTransition();

  const [form, setForm2] = useState({ name:"", arm:"A", level:"primary", sessionId: sessions.find(s=>s.isCurrent)?.id ?? sessions[0]?.id ?? "", formTeacherId:"", capacity:"40" });

  const resetForm = () => setForm2({ name:"", arm:"A", level:"primary", sessionId: sessions.find(s=>s.isCurrent)?.id ?? sessions[0]?.id ?? "", formTeacherId:"", capacity:"40" });

  const handleSave = () => {
    if (!editItem && !canCreateClass) return;
    if (!form.name.trim()) { setToast({ type:"error", message:"Class name is required." }); return; }
    start(async () => {
      // In production: call createClass / updateClass server action
      if (editItem) {
        setClasses(prev => sortClasses(prev.map(c => c.id === editItem.id ? { ...c, ...form } : c)));
        setToast({ type:"success", message:"Class updated." });
      } else {
        const newClass = { id:`cls_${Date.now()}`, ...form, _count:{ students:0, subjectAssignments:0 } };
        setClasses(prev => sortClasses([...prev, newClass]));
        setToast({ type:"success", message:"Class created." });
      }
      setForm(false); setEdit(null); resetForm();
    });
  };

  const handleDelete = () => {
    setClasses(prev => prev.filter(c => c.id !== delItem.id));
    setDel(null);
    setToast({ type:"success", message:"Class deleted." });
  };

  const LEVELS = [
    { value:"nursery",   label:"Nursery"   },
    { value:"primary",   label:"Primary"   },
    { value:"secondary", label:"Secondary" },
  ];
  const ARMS = ["A","B","C","D","E","Gold","Silver","Bronze"];

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{classes.length} class arm{classes.length !== 1 ? "s" : ""}</p>
        </div>
        {canCreateClass && (
          <button onClick={() => { resetForm(); setEdit(null); setForm(true); }} className="btn-primary btn-sm w-full justify-center gap-2 sm:w-auto">
            <Plus className="w-3.5 h-3.5"/> Add Class
          </button>
        )}
      </div>

      {/* Group by level */}
      {LEVELS.map(({ value: level, label }) => {
        const levelClasses = sortClasses(classes.filter(c => c.level === level));
        if (levelClasses.length === 0) return null;
        return (
          <div key={level}>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{label} School</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {levelClasses.map(cls => (
                <div key={cls.id} className="card card-body flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <School className="w-5 h-5 text-brand-600"/>
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">{cls.name} {cls.arm}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{cls._count?.students ?? 0} {learnerLabel}</span>
                        <span className="flex items-center gap-1"><BookMarked className="w-3 h-3"/>{cls._count?.subjectAssignments ?? 0} subjects</span>
                        {cls.capacity && <span>Cap: {cls.capacity}</span>}
                      </div>
                      {cls.formTeacher && (
                        <p className="text-xs text-muted mt-1">Form Teacher: <span className="text-ink font-medium">{cls.formTeacher.user?.name}</span></p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setForm2({ name:cls.name, arm:cls.arm, level:cls.level, sessionId:cls.sessionId, formTeacherId:cls.formTeacherId??"", capacity:String(cls.capacity??40) }); setEdit(cls); setForm(true); }} className="btn-ghost btn-icon btn-sm">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => setDel(cls)} className="btn-ghost btn-icon btn-sm hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {classes.length === 0 && (
        <EmptyState
          icon={School}
          title="No classes yet"
          description={canCreateClass ? "Create your first class to get started." : "No nursery classes have been assigned yet."}
          action={canCreateClass ? <button onClick={() => { setForm(true); setEdit(null); }} className="btn-primary btn-sm">Add First Class</button> : undefined}
        />
      )}

      {/* Form modal */}
      {showForm && (canCreateClass || editItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 slide-up">
            <h2 className="font-display font-bold text-xl text-ink">{editItem ? "Edit Class" : "Add Class"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Class Name *</label>
                <input value={form.name} onChange={e => setForm2(f => ({...f, name:e.target.value}))} className="input" placeholder="e.g. Year 7"/>
              </div>
              <div className="form-group">
                <label className="label">Arm *</label>
                <select value={form.arm} onChange={e => setForm2(f => ({...f, arm:e.target.value}))} className="input">
                  {ARMS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Level *</label>
                <select value={form.level} onChange={e => setForm2(f => ({...f, level:e.target.value}))} className="input">
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Capacity</label>
                <input type="number" value={form.capacity} onChange={e => setForm2(f => ({...f, capacity:e.target.value}))} className="input" min="1"/>
              </div>
              <div className="col-span-2 form-group">
                <label className="label">Academic Session</label>
                <select value={form.sessionId} onChange={e => setForm2(f => ({...f, sessionId:e.target.value}))} className="input">
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}{s.isCurrent?" (current)":""}</option>)}
                </select>
              </div>
              <div className="col-span-2 form-group">
                <label className="label">Form Teacher (optional)</label>
                <select value={form.formTeacherId} onChange={e => setForm2(f => ({...f, formTeacherId:e.target.value}))} className="input">
                  <option value="">— none —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.user?.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} className="btn-primary flex-1 justify-center">Save</button>
              <button onClick={() => { setForm(false); setEdit(null); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {delItem && (
        <ConfirmModal
          title={`Delete ${delItem.name} ${delItem.arm}?`}
          message="This will remove the class and unassign all linked students. This cannot be undone."
          confirmLabel="Delete Class" danger
          onConfirm={handleDelete}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
