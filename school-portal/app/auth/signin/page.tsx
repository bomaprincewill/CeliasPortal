"use client";
import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";

function SignInForm() {
  const router      = useRouter();
  const params      = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/admin/dashboard";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const completeSignIn = async () => {
    const activeSession = await getSession();
    const role = activeSession?.user?.role;
    const roleHome = ["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(role ?? "") ? "/admin/dashboard"
      : role === "BURSAR_ACCOUNTANT" || role === "SECRETARY" ? "/finance/dashboard"
      : role === "FORM_TEACHER" || role === "SUBJECT_TEACHER" ? "/teacher/dashboard"
      : role === "PARENT" ? "/parent/dashboard"
      : role === "STUDENT" ? "/student/dashboard" : "/applicant/dashboard";
    router.push(params.has("callbackUrl") ? callbackUrl : roleHome);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await signIn("credentials", { email: email.toLowerCase(), password, redirect: false });
    setLoading(false);
    if (res?.error) { setError("Invalid email or password."); return; }
    await completeSignIn();
  };

  const quickLogin = async (demoAccount: string) => {
    setLoading(true); setError("");
    const res = await signIn("credentials", { demoAccount, redirect: false });
    setLoading(false);
    if (res?.error) { setError("Demo login is unavailable. Run the development seed first."); return; }
    await completeSignIn();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-950 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white"/>
          </div>
          <span className="font-display font-bold text-white text-xl">SchoolPortal</span>
        </div>
        <div>
          <h1 className="font-display text-5xl font-bold text-white leading-tight mb-6">
            Manage your school.<br/>
            <span className="text-brand-400">All in one place.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-md">
            CBT exams, result processing, attendance tracking, parent reports — built for Nigerian primary & secondary schools.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[["CBT Engine","Terminal & entrance exams"],["Result RBAC","5-role access control"],["Auto-Compile","Rankings & grades"],["PDF Reports","Printable report cards"]].map(([t,d])=>(
              <div key={t} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="font-display text-sm font-bold text-brand-300">{t}</div>
                <div className="text-slate-400 text-xs mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-xs">© 2025 SchoolPortal. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white"/>
            </div>
            <span className="font-display font-bold text-ink text-xl">SchoolPortal</span>
          </div>

          <div className="page-header">
            <h2 className="page-title">Sign in</h2>
            <p className="page-subtitle">Enter your school credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="label">Email address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input" placeholder="you@school.edu" required/>
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)}
                  className="input pr-10" placeholder="••••••••" required/>
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Signing in…</> : "Sign in"}
            </button>
          </form>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-7 border-t border-border pt-5">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Demo quick login</p><span className="badge-yellow">Development only</span></div>
              <div className="grid grid-cols-2 gap-2">
                {[["Super Admin","admin@school.edu"],["Finance","finance@school.edu"],["Form Teacher","adaeze@school.edu"],["Subject Teacher","ngozi@school.edu"],["Parent","parent@school.edu"],["Applicant","applicant@school.edu"]].map(([label,account]) => <button key={account} type="button" disabled={loading} onClick={() => quickLogin(account)} className="btn-secondary btn-sm justify-center">{label}</button>)}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" aria-label="Loading sign-in form" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
