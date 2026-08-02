"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/actions/auth/passwordReset";

export default function CompletePasswordResetPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) return setError("Passwords do not match.");
    setLoading(true); const result = await resetPassword(token, password); setLoading(false);
    if (!result.success) return setError(result.error ?? "Password could not be changed.");
    router.replace("/auth/signin?reset=success");
  };
  return <div className="min-h-screen flex items-center justify-center p-6 bg-surface"><form onSubmit={submit} className="card card-body w-full max-w-sm space-y-4">
    <div><h1 className="page-title">Choose a new password</h1><p className="page-subtitle">Use at least 12 characters with uppercase, lowercase, and a number.</p></div>
    {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
    <div className="form-group"><label className="label">New password</label><input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></div>
    <div className="form-group"><label className="label">Confirm password</label><input type="password" className="input" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required /></div>
    <button disabled={loading} className="btn-primary w-full justify-center">{loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : "Save new password"}</button>
  </form></div>;
}
