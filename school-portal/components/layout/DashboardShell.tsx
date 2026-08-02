"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui";
import { BookOpen, Menu } from "lucide-react";
import { useState } from "react";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner className="w-8 h-8 text-brand-600"/>
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600"><BookOpen className="h-4 w-4 text-white" /></div>
            <span className="font-display font-bold text-ink">SchoolPortal</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost btn-icon" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
        </main>
      </div>
    </div>
  );
}
