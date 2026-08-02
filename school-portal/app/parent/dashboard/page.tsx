import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, FileText, Calendar, BarChart2, ChevronRight } from "lucide-react";
import { TERM_LABELS } from "@/types";
import type { Term } from "@/types";

export default async function ParentDashboard() {
  const session = await getSession();
  if (!session || session.user.role !== "PARENT") redirect("/auth/signin");

  const parent = await prisma.parent.findFirst({
    where: { userId: session.user.id },
    include: {
      children: {
        include: {
          student: {
            include: {
              class: { select: { name:true, arm:true } },
            },
          },
        },
      },
    },
  });

  if (!parent) return <div className="p-8 text-muted">Parent record not found. Contact the school administrator.</div>;

  const children = parent.children.map(c => c.student);

  // Fetch latest result summary for each child
  const currentSession = await prisma.academicSession.findFirst({ where:{ isCurrent:true } });
  const resultSummaries = await Promise.all(
    children.map(child =>
      prisma.broadSheet.findFirst({
        where: { studentId: child.id, sessionId: currentSession?.id ?? "" },
        orderBy: { computedAt: "desc" },
      })
    )
  );

  // Attendance this week
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const attendanceSummaries = await Promise.all(
    children.map(child =>
      prisma.attendance.groupBy({
        by: ["status"],
        where: { studentId: child.id, date: { gte: weekStart } },
        _count: { status: true },
      })
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-muted text-sm mt-1">
          {currentSession ? `Academic Session: ${currentSession.name}` : ""}
        </p>
      </div>

      {children.length === 0 && (
        <div className="card card-body text-center py-12 text-muted">
          <GraduationCap className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
          <p>No children linked to your account. Contact the school to link your ward.</p>
        </div>
      )}

      {children.map((child, idx) => {
        const summary    = resultSummaries[idx];
        const attendance = attendanceSummaries[idx];
        const presentCount = attendance.find(a => a.status === "PRESENT")?._count?.status ?? 0;
        const absentCount  = attendance.find(a => a.status === "ABSENT")?._count?.status  ?? 0;

        return (
          <div key={child.id} className="card">
            {/* Child header */}
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                  {child.firstName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-semibold text-ink">{child.firstName} {child.lastName}</h2>
                  <p className="text-xs text-muted">{child.class?.name} {child.class?.arm} · {child.studentId}</p>
                </div>
              </div>
              <Link href={`/parent/report/${child.id}`} className="btn-primary btn-sm gap-2">
                <FileText className="w-3.5 h-3.5"/> Report Card
              </Link>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { label:"Average Score",    value: summary ? `${summary.averageScore.toFixed(1)}%` : "—", icon:BarChart2,    color:"text-brand-600" },
                { label:"Class Position",   value: summary ? `${summary.position}/${summary.outOf}` : "—", icon:GraduationCap,color:"text-emerald-600" },
                { label:"Attendance (week)",value: `${presentCount}P / ${absentCount}A`,                   icon:Calendar,     color:"text-purple-600" },
              ].map(({ label, value, icon:Icon, color }) => (
                <div key={label} className="px-5 py-4 text-center">
                  <div className={`font-display text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Links */}
            <div className="divide-y divide-border">
              {[
                { label:"View Full Report Card",      href:`/parent/report/${child.id}`,            desc:"Detailed academic results and teacher comments" },
                { label:"Attendance Record",          href:`/parent/attendance?studentId=${child.id}`,desc:"View weekly and monthly attendance" },
              ].map(({ label, href, desc }) => (
                <Link key={href} href={href} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-ink">{label}</div>
                    <div className="text-xs text-muted mt-0.5">{desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted flex-shrink-0"/>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
