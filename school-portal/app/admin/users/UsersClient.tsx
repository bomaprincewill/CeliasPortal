"use client";
import { useState, useTransition } from "react";
import { Plus, Search, Trash2, Edit2, ChevronDown, Loader2, Upload, FileText, Eye, EyeOff } from "lucide-react";
import { SectionCard, ConfirmModal, Toast, EmptyState } from "@/components/ui";
import { ROLE_LABELS } from "@/types";
import { createPortalUser } from "@/actions/users/createPortalUser";
import { updateUserCredentials } from "@/actions/users/updateUserCredentials";
import { bulkUploadUsers } from "@/actions/users/bulkUploadUsers";
import { createFinanceStaff } from "@/actions/users/createFinanceStaff";

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN:"badge-blue", FORM_TEACHER:"badge-green",
  ADMIN:"badge-blue", NURSERY_HEAD:"badge-purple", PRIMARY_HEAD:"badge-green", PRINCIPAL:"badge-blue",
  BURSAR_ACCOUNTANT:"badge-green", SECRETARY:"badge-blue",
  SUBJECT_TEACHER:"badge-yellow", PARENT:"badge-purple", APPLICANT:"badge-gray",
};

export default function UsersClient({ initialUsers, classes, subjects, academicSessions }: { initialUsers: any[]; classes: any[]; subjects: any[]; academicSessions: { name:string; isCurrent:boolean }[] }) {
  const [users, setUsers]       = useState(initialUsers);
  const [search, setSearch]     = useState("");
  const [roleFilter, setRole]   = useState("");
  const [showForm, setForm]     = useState(false);
  const [showUpload, setUpload] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [editUser, setEdit]     = useState<any>(null);
  const [deleteUser, setDelete] = useState<any>(null);
  const [toast, setToast]       = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, start]      = useTransition();

  // Form state
  const emptyForm = {
    name:"", email:"", role:"SUBJECT_TEACHER", password:"", phone:"", classId:"", subjectIds:[] as string[],
    relationship:"PARENT", occupation:"", firstName:"", lastName:"", middleName:"", dateOfBirth:"", gender:"MALE",
    applyingForClass:"", academicSession:academicSessions.find(s=>s.isCurrent)?.name ?? academicSessions[0]?.name ?? "", address:"",
  };
  const [form, setForm2] = useState(emptyForm);

  const visible = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSubject = (id: string) =>
    setForm2(f => ({ ...f, subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter(s=>s!==id) : [...f.subjectIds, id] }));

  const roleLabel = (user: any) => {
    if (user.role === "STUDENT" && ["nursery", "primary"].includes(user.student?.class?.level?.toLowerCase())) return "Pupil";
    return ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role;
  };

  const handleSave = () => {
    if (editUser) {
      start(async () => {
        const result = await updateUserCredentials({
          userId: editUser.id,
          name: form.name,
          email: form.email,
          password: form.password || undefined,
        });
        if (!result.success || !result.user) {
          setToast({ type:"error", message:result.error ?? "Unable to update user." });
          return;
        }
        setUsers(prev => prev.map(u => u.id===editUser.id ? { ...u, ...result.user } : u));
        setToast({ type:"success", message:"User credentials updated." });
        setForm(false); setEdit(null); setForm2(emptyForm);
      });
    } else if (form.role === "BURSAR_ACCOUNTANT" || form.role === "SECRETARY") {
      start(async () => {
        const result = await createFinanceStaff({ name:form.name,email:form.email,password:form.password,role:form.role as "BURSAR_ACCOUNTANT"|"SECRETARY" });
        if(!result.success||!result.user){setToast({type:"error",message:result.error??"Unable to create finance staff."});return;}
        setUsers(prev=>[result.user,...prev]);setToast({type:"success",message:"Finance staff account created."});setForm(false);setForm2(emptyForm);
      });
    } else if (form.role === "PARENT" || form.role === "APPLICANT") {
      start(async () => {
        const result = await createPortalUser({
          role: form.role as "PARENT" | "APPLICANT", email: form.email, password: form.password, phone: form.phone,
          name: form.name, relationship: form.relationship, occupation: form.occupation,
          firstName: form.firstName, lastName: form.lastName, middleName: form.middleName,
          dateOfBirth: form.dateOfBirth, gender: form.gender as "MALE"|"FEMALE"|"OTHER",
          applyingForClass: form.applyingForClass, academicSession: form.academicSession, address: form.address,
        });
        if (!result.success || !result.user) {
          setToast({ type:"error", message:result.error ?? "Unable to create user." });
          return;
        }
        setUsers(prev => [result.user, ...prev]);
        setToast({ type:"success", message:`${form.role === "PARENT" ? "Parent" : "Applicant"} created successfully.` });
        setForm(false); setEdit(null); setForm2(emptyForm);
      });
    } else {
      const newUser = { id: `u_${Date.now()}`, ...form, isActive:true, createdAt: new Date().toISOString() };
      setUsers(prev => [newUser, ...prev]);
      setToast({ type:"success", message:"User created." });
      setForm(false); setEdit(null); setForm2(emptyForm);
    }
  };

  const handleDelete = () => {
    // In production: call server action deleteUser
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
    setDelete(null);
    setToast({ type:"success", message:"User deleted." });
  };

  const handleBulkUpload = (formData: FormData) => {
    start(async () => {
      const result = await bulkUploadUsers(formData);
      setUploadErrors(result.errors);
      setToast({ type:result.success ? "success" : "error", message:result.message });
      if (result.users.length) setUsers(prev => [...result.users, ...prev]);
      if (result.success && result.errors.length === 0) setUpload(false);
    });
  };

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{visible.length} of {users.length} users</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={()=>{setUploadErrors([]);setUpload(true)}} className="btn-secondary btn-sm flex-1 justify-center gap-2 sm:flex-none">
            <Upload className="w-3.5 h-3.5"/>Bulk Word Upload
          </button>
          <button onClick={()=>{setEdit(null);setForm2(emptyForm);setShowPassword(false);setForm(true)}} className="btn-primary btn-sm flex-1 justify-center gap-2 sm:flex-none">
            <Plus className="w-3.5 h-3.5"/>Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…" className="input pl-9"/>
        </div>
        <div className="relative w-full sm:w-auto">
          <select value={roleFilter} onChange={e=>setRole(e.target.value)} className="input appearance-none pr-8 sm:min-w-40">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"/>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-muted">No users found.</td></tr>
            )}
            {visible.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
                      {u.name?.charAt(0)}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="text-muted">{u.email}</td>
                <td><span className={ROLE_BADGE[u.role] ?? "badge-gray"}>{roleLabel(u)}</span></td>
                <td><span className={u.isActive?"badge-green":"badge-red"}>{u.isActive?"Active":"Inactive"}</span></td>
                <td className="text-muted text-xs">{new Date(u.createdAt).toLocaleDateString("en-NG")}</td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={()=>{setEdit(u);setForm2({...emptyForm,name:u.name,email:u.email,role:u.role,password:""});setShowPassword(false);setForm(true)}} className="btn-ghost btn-sm btn-icon">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={()=>setDelete(u)} className="btn-ghost btn-sm btn-icon hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4 slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display font-bold text-xl text-ink">{editUser?"Edit User":"Add User"}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={`form-group sm:col-span-2 ${form.role === "APPLICANT" && !editUser ? "hidden" : ""}`}>
                <label className="label">Full Name</label>
                <input value={form.name} onChange={e=>setForm2(f=>({...f,name:e.target.value}))} className="input" placeholder="Mrs. Adaeze Obi"/>
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e=>setForm2(f=>({...f,email:e.target.value}))} className="input" placeholder="user@school.edu"/>
              </div>
              {(form.role === "PARENT" || form.role === "APPLICANT") && (
                <div className="form-group">
                  <label className="label">Phone Number</label>
                  <input value={form.phone} onChange={e=>setForm2(f=>({...f,phone:e.target.value}))} className="input" placeholder="+234 800 000 0000"/>
                </div>
              )}
              <div className="form-group">
                <label className="label">Role</label>
                <select value={form.role} disabled={Boolean(editUser)} onChange={e=>setForm2(f=>({...f,role:e.target.value}))} className="input disabled:cursor-not-allowed disabled:bg-slate-100">
                  {Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group sm:col-span-2">
                <label className="label">{editUser ? "New Password (leave blank to keep current)" : "Initial Password"}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={e=>setForm2(f=>({...f,password:e.target.value}))}
                    className="input pr-11 font-mono"
                    placeholder={editUser ? "Minimum 8 characters" : undefined}
                  />
                  <button
                    type="button"
                    onClick={()=>setShowPassword(visible=>!visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-colors hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </button>
                </div>
              </div>
              {form.role === "PARENT" && (
                <>
                  <div className="form-group">
                    <label className="label">Relationship</label>
                    <select value={form.relationship} onChange={e=>setForm2(f=>({...f,relationship:e.target.value}))} className="input">
                      <option value="PARENT">Parent</option><option value="GUARDIAN">Guardian</option><option value="SPONSOR">Sponsor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Occupation</label>
                    <input value={form.occupation} onChange={e=>setForm2(f=>({...f,occupation:e.target.value}))} className="input"/>
                  </div>
                </>
              )}
              {form.role === "APPLICANT" && (
                <>
                  <div className="form-group"><label className="label">First Name *</label><input value={form.firstName} onChange={e=>setForm2(f=>({...f,firstName:e.target.value}))} className="input"/></div>
                  <div className="form-group"><label className="label">Last Name *</label><input value={form.lastName} onChange={e=>setForm2(f=>({...f,lastName:e.target.value}))} className="input"/></div>
                  <div className="form-group sm:col-span-2"><label className="label">Middle Name</label><input value={form.middleName} onChange={e=>setForm2(f=>({...f,middleName:e.target.value}))} className="input"/></div>
                  <div className="form-group"><label className="label">Date of Birth *</label><input type="date" value={form.dateOfBirth} onChange={e=>setForm2(f=>({...f,dateOfBirth:e.target.value}))} className="input"/></div>
                  <div className="form-group"><label className="label">Gender *</label><select value={form.gender} onChange={e=>setForm2(f=>({...f,gender:e.target.value}))} className="input"><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
                  <div className="form-group"><label className="label">Applying for Class *</label><select value={form.applyingForClass} onChange={e=>setForm2(f=>({...f,applyingForClass:e.target.value}))} className="input"><option value="">— select class —</option>{classes.map(c=>{const label=`${c.name} ${c.arm}`;return <option key={c.id} value={label}>{label}</option>})}</select></div>
                  <div className="form-group"><label className="label">Academic Session *</label><select value={form.academicSession} onChange={e=>setForm2(f=>({...f,academicSession:e.target.value}))} className="input">{academicSessions.map(s=><option key={s.name} value={s.name}>{s.name}{s.isCurrent?" (Current)":""}</option>)}</select></div>
                  <div className="form-group sm:col-span-2"><label className="label">Address</label><textarea value={form.address} onChange={e=>setForm2(f=>({...f,address:e.target.value}))} className="input resize-none" rows={2}/></div>
                </>
              )}
              {(form.role==="FORM_TEACHER") && (
                <div className="form-group sm:col-span-2">
                  <label className="label">Assigned Class (Form Teacher)</label>
                  <select value={form.classId} onChange={e=>setForm2(f=>({...f,classId:e.target.value}))} className="input">
                    <option value="">— select class —</option>
                    {classes.map(c=><option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                  </select>
                </div>
              )}
              {(form.role==="SUBJECT_TEACHER"||form.role==="FORM_TEACHER") && (
                <div className="form-group sm:col-span-2">
                  <label className="label">Assigned Subjects</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {subjects.map(s=>(
                      <button key={s.id} type="button" onClick={()=>toggleSubject(s.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${form.subjectIds.includes(s.id)?"border-brand-600 bg-brand-50 text-brand-700":"border-border text-muted hover:border-brand-200"}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1 justify-center">{isPending ? <><Loader2 className="h-4 w-4 animate-spin"/>Saving…</> : "Save"}</button>
              <button onClick={()=>{setForm(false);setEdit(null);setShowPassword(false)}} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4 slide-up">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><FileText className="h-5 w-5"/></div>
              <div>
                <h2 className="font-display font-bold text-xl text-ink">Bulk Upload Users</h2>
                <p className="mt-1 text-sm text-muted">Upload a Word table containing one account per row.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-ink">Required table columns</p>
              <p className="mt-1 font-mono text-xs">Name | Email | Password | Role | Student ID</p>
              <p className="mt-2 text-xs text-muted">Roles include Pupil and Student. Student ID (or Admission No) is required only for learner rows and must match an existing record. Nursery pupils do not receive accounts; their parents view results through linked parent accounts.</p>
            </div>
            <form action={handleBulkUpload} className="space-y-4">
              <input name="file" type="file" required accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input py-2"/>
              {uploadErrors.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {uploadErrors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
                  {isPending ? <><Loader2 className="h-4 w-4 animate-spin"/>Uploading…</> : "Upload Users"}
                </button>
                <button type="button" disabled={isPending} onClick={()=>setUpload(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteUser && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete "${deleteUser.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={()=>setDelete(null)}
        />
      )}
    </div>
  );
}
