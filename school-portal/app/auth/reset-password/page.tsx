"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth/passwordReset";
import SchoolLogo from "@/components/SchoolLogo";
import BetaBadge from "@/components/BetaBadge";
import { usesAdministratorRecovery } from "@/lib/passwordRecovery";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await requestPasswordReset(email);
      if (!result.success) { setError(result.error); return; }
      setMessage(result.message);
      setSent(true);
    } catch { setError("Unable to request a reset. Please try again or contact the school administrator."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-1.5 mb-8">
          <SchoolLogo className="h-14 w-14" priority />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-ink text-xl">Celias Portal</span>
            <BetaBadge />
          </div>
        </div>

        {!sent ? (
          <>
            <div className="page-header">
              <h2 className="page-title">Reset password</h2>
              <p className="page-subtitle">Enter your email or portal login to see your recovery options.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label htmlFor="recovery-login" className="label">Email or portal login</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"/>
                  <input id="recovery-login" type="text" value={email} onChange={e=>setEmail(e.target.value)}
                    className="input pl-9" placeholder="you@school.edu" required/>
                </div>
              </div>
              <p className="text-xs text-muted">For @celiasportal.com logins, ask the school administrator for a one-time password setup link.</p>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Sending…</> : "Send reset link"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-500"/>
            </div>
            <h2 className="font-display text-xl font-bold text-ink">{usesAdministratorRecovery(email) ? "Contact the school administrator" : "Check your email"}</h2>
            <p className="text-sm text-muted">{message}</p>
          </div>
        )}

        <Link href="/auth/signin" className="flex items-center gap-2 text-sm text-muted hover:text-ink mt-6">
          <ArrowLeft className="w-4 h-4"/> Back to sign in
        </Link>
      </div>
    </div>
  );
}
