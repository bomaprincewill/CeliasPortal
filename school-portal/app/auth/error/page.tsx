"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const error = useSearchParams().get("error");
  const message = error === "AccessDenied"
    ? "You do not have permission to sign in with these credentials."
    : "We could not complete your sign-in. Please try again.";

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="page-title">Sign-in unavailable</h1>
        <p className="page-subtitle mt-2">{message}</p>
        <Link href="/auth/signin" className="btn-primary mt-6 inline-flex">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
