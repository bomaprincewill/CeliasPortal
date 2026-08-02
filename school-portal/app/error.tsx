"use client";
import { useEffect } from "react";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(JSON.stringify({ level:"error",event:"ui.route_error",message:error.message,digest:error.digest })); }, [error]);
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center p-6 text-center"><h1 className="page-title">Something went wrong</h1><p className="mt-2 text-sm text-muted">The page could not be loaded. Try again, or contact the administrator if this continues.</p>{error.digest&&<p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}<button onClick={reset} className="btn-primary mt-5">Try again</button></div>;
}
