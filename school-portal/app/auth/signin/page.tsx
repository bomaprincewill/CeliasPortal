"use client";
import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import SchoolLogo from "@/components/SchoolLogo";
import BetaBadge from "@/components/BetaBadge";

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
    const demoDestinations: Record<string, string> = {
      "admin@school.edu": "/admin/dashboard",
      "finance@school.edu": "/finance/dashboard",
      "adaeze@school.edu": "/teacher/dashboard",
      "ngozi@school.edu": "/teacher/dashboard",
      "parent@school.edu": "/parent/dashboard",
      "applicant@school.edu": "/applicant/dashboard",
    };
    const destination = demoDestinations[demoAccount] ?? "/auth/signin";
    const res = await signIn("credentials", { demoAccount, redirect: false, callbackUrl: destination });
    setLoading(false);
    if (res?.error) { setError("Demo login is unavailable. Run the development seed first."); return; }
    window.location.assign(destination);
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sign-in form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-1.5 mb-8">
            <SchoolLogo className="h-16 w-16" priority />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-ink text-xl">Celias Portal</span>
              <BetaBadge />
            </div>
          </div>

          <div className="page-header">
            <h2 className="page-title">Sign in</h2>
            <p className="page-subtitle">Enter your school credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="label" htmlFor="login">Email or student login</label>
              <input id="login" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} className="input" placeholder="name@celiasportal.com" required/>
            </div>
              <div className="form-group">
                <div className="flex items-center justify-between"><label className="label">Password</label><Link href="/auth/reset-password" className="text-xs font-medium text-brand-700 hover:text-brand-900">Forgot password?</Link></div>
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
