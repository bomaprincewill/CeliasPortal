"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, MessageCircle, Plus, Trash2, UserCheck, X } from "lucide-react";
import { generateApplicantAccount } from "@/actions/users/createPortalUser";
import { deleteApplicant } from "@/actions/applicants/deleteApplicant";
import { ConfirmModal, Toast } from "@/components/ui";
import { approveApplicant } from "@/actions/applicants/approveApplicant";
import { enrollApplicant } from "@/actions/students/manageEnrollment";

const emptyForm = {
  firstName: "", lastName: "", middleName: "", email: "",
  dateOfBirth: "", gender: "MALE", applyingForClass: "", academicSession: "",
};

export default function ApplicantAccountsClient({
  initialApplicants,
  classNames,
  sessionNames,
  enrollmentClasses,
}: {
  initialApplicants: any[];
  classNames: string[];
  sessionNames: string[];
  enrollmentClasses: { id: string; label: string }[];
}) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, applyingForClass: classNames[0] ?? "", academicSession: sessionNames[0] ?? "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState<any>(null);
  const [removeTarget, setRemoveTarget] = useState<any>(null);
  const [pending, startTransition] = useTransition();
  const [enrollmentClass, setEnrollmentClass] = useState<Record<string, string>>({});
  const [setup, setSetup] = useState<{ url: string; name: string; applicationNo: string } | null>(null);

  const createAccount = () => {
    setError("");
    startTransition(async () => {
      const result = await generateApplicantAccount({
        ...form,
        gender: form.gender as "MALE" | "FEMALE" | "OTHER",
      });
      if (!result.success || !result.user) {
        setError(result.error ?? "Applicant account could not be generated.");
        return;
      }
      setApplicants((current) => [result.user, ...current]);
      setToast({ type: "success", message: "Applicant created and awaiting approval. Credentials have not been sent." });
      setShowForm(false);
      setForm({ ...emptyForm, applyingForClass: classNames[0] ?? "", academicSession: sessionNames[0] ?? "" });
    });
  };

  const approveAndSend = (applicant: any) => {
    startTransition(async () => {
      const result = await approveApplicant(applicant.id);
      if (!result.success) {
        setToast({ type: "error", message: result.error ?? "Applicant could not be approved." });
        return;
      }
      setApplicants(current => current.map(item => item.id === applicant.id ? { ...item, isActive: true } : item));
      setSetup(result.setup ?? null);
      setToast({ type: "success", message: `${applicant.name} was approved. Share the one-time setup link.` });
    });
  };

  const setupMessage = setup
    ? `Hello ${setup.name}, your Celias Schools applicant account is ready. Application number: ${setup.applicationNo}. Create your password using this secure one-time link (valid for 24 hours): ${setup.url}`
    : "";

  const copySetupLink = async () => {
    if (!setup) return;
    await navigator.clipboard.writeText(setupMessage);
    setToast({ type: "success", message: "Setup message copied. You can paste it into WhatsApp or SMS." });
  };

  const removeApplicant = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await deleteApplicant(removeTarget.id);
      if (!result.success) {
        setToast({ type: "error", message: result.error ?? "Applicant could not be removed." });
        setRemoveTarget(null);
        return;
      }
      setApplicants(current => current.filter(applicant => applicant.id !== removeTarget.id));
      setToast({ type: "success", message: `${removeTarget.name} was removed.` });
      setRemoveTarget(null);
    });
  };

  const enroll = (applicant: any) => {
    const classId = enrollmentClass[applicant.id] ?? enrollmentClasses[0]?.id;
    if (!classId) return setToast({ type: "error", message: "Create a destination class before enrolling applicants." });
    startTransition(async () => {
      const result = await enrollApplicant(applicant.id, classId);
      if (!result.success) return setToast({ type: "error", message: result.error ?? "Applicant could not be enrolled." });
      setApplicants(current => current.filter(item => item.id !== applicant.id));
      setToast({ type: "success", message: `${applicant.name} is now enrolled as ${result.studentId}.` });
    });
  };

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Applicant Accounts</h1>
          <p className="page-subtitle">Create applicants, approve them, then share a secure one-time setup link.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="h-4 w-4" />Create Applicant</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Application No.</th><th>Class</th><th>Admission</th><th>Account</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {applicants.map((applicant) => (
              <tr key={applicant.id}>
                <td className="font-medium">{applicant.name}</td>
                <td>{applicant.email}</td>
                <td className="font-mono text-xs">{applicant.applicant?.applicationNo ?? "—"}</td>
                <td>{applicant.applicant?.applyingForClass ?? "—"}</td>
                <td><span className="badge-yellow">{applicant.applicant?.status ?? "PENDING"}</span></td>
                <td><span className={applicant.isActive ? "badge-green" : "badge-yellow"}>{applicant.isActive ? "Approved" : "Pending Approval"}</span></td>
                <td className="text-right">
                  {!applicant.isActive && (
                    <button disabled={pending} onClick={() => approveAndSend(applicant)} className="btn-ghost btn-sm text-emerald-700 gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />Approve &amp; Get Link
                    </button>
                  )}
                  {applicant.isActive && <div className="inline-flex items-center gap-1">
                    <select className="input py-1 text-xs w-36" value={enrollmentClass[applicant.id] ?? enrollmentClasses[0]?.id ?? ""} onChange={event => setEnrollmentClass(current => ({ ...current, [applicant.id]: event.target.value }))}>
                      {enrollmentClasses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <button disabled={pending} onClick={() => enroll(applicant)} className="btn-ghost btn-sm text-brand-700 gap-1"><UserCheck className="h-3.5 w-3.5"/>Enroll</button>
                  </div>}
                  <button onClick={() => setRemoveTarget(applicant)} className="btn-ghost btn-sm text-danger gap-1" aria-label={`Remove ${applicant.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />Remove
                  </button>
                </td>
              </tr>
            ))}
            {applicants.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted">No applicants created.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-brand-600" />
              <h2 className="font-display text-xl font-bold">Create Applicant</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["firstName", "lastName", "middleName", "email"] as const).map((field) => (
                <div key={field} className="form-group">
                  <label className="label">{field === "firstName" ? "First name" : field === "lastName" ? "Last name" : field === "middleName" ? "Middle name" : "Email"}{field !== "middleName" && " *"}</label>
                  <input type={field === "email" ? "email" : "text"} className="input" value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} required={field !== "middleName"} />
                </div>
              ))}
              <div className="form-group">
                <label className="label">Date of birth *</label>
                <input type="date" className="input" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                  <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Applying for class *</label>
                <select className="input" value={form.applyingForClass} onChange={(event) => setForm((current) => ({ ...current, applyingForClass: event.target.value }))}>
                  {classNames.map((name) => <option key={name}>{name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Academic session *</label>
                <select className="input" value={form.academicSession} onChange={(event) => setForm((current) => ({ ...current, academicSession: event.target.value }))}>
                  {sessionNames.map((name) => <option key={name}>{name}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={createAccount} disabled={pending} className="btn-primary flex-1 justify-center">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}Create Applicant
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmModal
          title={`Remove ${removeTarget.name}?`}
          message="This permanently removes the applicant account and any entrance-exam submissions associated with it."
          confirmLabel={pending ? "Removing..." : "Remove Applicant"}
          danger
          onConfirm={removeApplicant}
          onCancel={() => !pending && setRemoveTarget(null)}
        />
      )}

      {setup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">Share setup link</h2>
                <p className="mt-1 text-sm text-muted">This link works once and expires after 24 hours.</p>
              </div>
              <button onClick={() => setSetup(null)} className="btn-ghost p-2" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 rounded-xl bg-surface p-4 text-sm break-words">
              <p className="font-medium">{setup.name}</p>
              <p className="mt-1 text-muted">{setup.applicationNo}</p>
              <p className="mt-3 font-mono text-xs">{setup.url}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={copySetupLink} className="btn-secondary justify-center"><Copy className="h-4 w-4" />Copy message</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(setupMessage)}`} target="_blank" rel="noreferrer" className="btn-primary justify-center"><MessageCircle className="h-4 w-4" />Send via WhatsApp</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
