"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { changeOwnPassword } from "@/actions/auth/changeOwnPassword";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (newPassword !== confirmation) return setMessage({ type: "error", text: "New passwords do not match." });
    startTransition(async () => {
      const result = await changeOwnPassword(currentPassword, newPassword);
      if (!result.success) return setMessage({ type: "error", text: result.error });
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setMessage({ type: "success", text: "Your password has been changed successfully." });
    });
  };

  const fields = [
    { label: "Current password", value: currentPassword, setValue: setCurrentPassword, autoComplete: "current-password" },
    { label: "New password", value: newPassword, setValue: setNewPassword, autoComplete: "new-password" },
    { label: "Confirm new password", value: confirmation, setValue: setConfirmation, autoComplete: "new-password" },
  ];

  return <form onSubmit={submit} className="card card-body max-w-lg space-y-4">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><LockKeyhole className="h-5 w-5"/></div><div><h2 className="font-display text-lg font-bold">Change password</h2><p className="text-sm text-muted">Use at least 12 characters with uppercase, lowercase, and a number.</p></div></div>
    {fields.map(field => <div key={field.label} className="form-group"><label className="label">{field.label}</label><div className="relative"><input type={showPasswords ? "text" : "password"} value={field.value} onChange={event=>field.setValue(event.target.value)} autoComplete={field.autoComplete} className="input pr-11" required/><button type="button" onClick={()=>setShowPasswords(value=>!value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink" aria-label={showPasswords ? "Hide passwords" : "Show passwords"}>{showPasswords ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>)}
    {message && <p className={`rounded-lg p-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
    <button disabled={pending} className="btn-primary justify-center">{pending ? <><Loader2 className="h-4 w-4 animate-spin"/>Changing password…</> : "Change password"}</button>
  </form>;
}
