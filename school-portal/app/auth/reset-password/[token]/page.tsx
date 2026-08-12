"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPassword } from "@/actions/auth/passwordReset";

export default function CompletePasswordResetPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
    <div className="form-group">
      <label className="label">New password</label>
      <div className="relative">
        <input suppressHydrationWarning type={showPassword ? "text" : "password"} className="input pr-11" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink" aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword}>
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
    <div className="form-group">
      <label className="label">Confirm password</label>
      <div className="relative">
        <input suppressHydrationWarning type={showConfirmation ? "text" : "password"} className="input pr-11" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required />
        <button type="button" onClick={() => setShowConfirmation(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink" aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmation}>
          {showConfirmation ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
    <button disabled={loading} className="btn-primary w-full justify-center">{loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : "Save new password"}</button>
  </form></div>;
}
