"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth/passwordReset";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (!result.success) return alert(result.error);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white"/>
          </div>
          <span className="font-display font-bold text-ink text-xl">SchoolPortal</span>
        </div>

        {!sent ? (
          <>
            <div className="page-header">
              <h2 className="page-title">Reset password</h2>
              <p className="page-subtitle">Enter your email and we'll send a reset link.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"/>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    className="input pl-9" placeholder="you@school.edu" required/>
                </div>
              </div>
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
            <h2 className="font-display text-xl font-bold text-ink">Check your email</h2>
            <p className="text-sm text-muted">A password reset link was sent to <strong>{email}</strong>. Check your inbox and spam folder.</p>
          </div>
        )}

        <Link href="/auth/signin" className="flex items-center gap-2 text-sm text-muted hover:text-ink mt-6">
          <ArrowLeft className="w-4 h-4"/> Back to sign in
        </Link>
      </div>
    </div>
  );
}
