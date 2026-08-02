import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/ui";
import {
  Users, GraduationCap, BookMarked, School,
  ClipboardList, BarChart2, Calendar, Shield,
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ROLE_LABELS } from "@/types";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);
  const isNurseryHead = session.user.role === "NURSERY_HEAD";
  const usesPupilTerminology = ["NURSERY_HEAD", "PRIMARY_HEAD"].includes(session.user.role);
  const hasLimitedManagement = [...(["NURSERY_HEAD", "PRIMARY_HEAD"] as const), "PRINCIPAL"].includes(session.user.role as "NURSERY_HEAD" | "PRIMARY_HEAD" | "PRINCIPAL");
  const classLevelFilter = level
    ? { level: { equals: level, mode: "insensitive" as const } }
    : undefined;

  const [
    totalStudents, totalTeachers, totalParents,
    totalClasses, totalSubjects,
    pendingResults, lockedResults,
    recentAudit, currentSession,
    pendingApplicants,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true, ...(level ? { class: classLevelFilter } : {}) } }),
    prisma.teacher.count({ where: level ? { OR: [
      { formTeacherOfClass: classLevelFilter },
      { assignments: { some: { class: classLevelFilter } } },
    ] } : undefined }),
    prisma.parent.count({ where: level ? { children: { some: { student: { class: classLevelFilter } } } } : undefined }),
    prisma.class.count({ where: classLevelFilter }),
    prisma.subject.count({ where: { isActive: true, ...(level ? { assignments: { some: { class: classLevelFilter } } } : {}) } }),
    prisma.result.count({ where: { status: "SUBMITTED", ...(level ? { class: classLevelFilter } : {}) } }),
    prisma.result.count({ where: { status: "LOCKED", ...(level ? { class: classLevelFilter } : {}) } }),
    level
      ? Promise.resolve([])
      : prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, role: true } } } }),
    prisma.academicSession.findFirst({ where: { isCurrent: true } }),
    level ? Promise.resolve(0) : prisma.applicant.count({ where: { status: "PENDING" } }),
  ]);

  const welcomeName = session.user.name?.trim() || ROLE_LABELS[session.user.role];

  const actionBadge: Record<string, string> = {
    LOGIN:"badge-gray", LOGOUT:"badge-gray", CREATE:"badge-green", UPDATE:"badge-blue",
    DELETE:"badge-red", SUBMIT:"badge-yellow", APPROVE:"badge-blue", LOCK:"badge-purple",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Welcome, {welcomeName}
          </h1>
          <p className="text-muted mt-1">
            {currentSession ? `Academic Session: ${currentSession.name}` : "No active session set"}
          </p>
        </div>
        {pendingResults > 0 && (
          <div className="card border-yellow-200 bg-yellow-50 card-body py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600"/>
            <span className="text-sm font-medium text-yellow-800">{pendingResults} result{pendingResults!==1?"s":""} awaiting approval</span>
            <Link href="/admin/results" className="btn-warn btn-sm">Review</Link>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={usesPupilTerminology ? "Pupils" : "Students"} value={totalStudents} icon={<GraduationCap className="w-5 h-5" />} color="bg-brand-50 text-brand-600" border="border-brand-100"/>
        <StatCard label="Teachers"   value={totalTeachers}    icon={<Users className="w-5 h-5" />}         color="bg-emerald-50 text-emerald-600" border="border-emerald-100"/>
        <StatCard label="Classes"    value={totalClasses}     icon={<School className="w-5 h-5" />}        color="bg-purple-50 text-purple-600"  border="border-purple-100"/>
        {!hasLimitedManagement && (
          <StatCard label="Subjects" value={totalSubjects} icon={<BookMarked className="w-5 h-5" />} color="bg-orange-50 text-orange-600" border="border-orange-100"/>
        )}
        <StatCard label="Parents"    value={totalParents}     icon={<Users className="w-5 h-5" />}         color="bg-cyan-50 text-cyan-600"      border="border-cyan-100"/>
        <StatCard label="Pending Results"  value={pendingResults}  icon={<Clock className="w-5 h-5" />}    color="bg-yellow-50 text-yellow-600"  border="border-yellow-100"/>
        <StatCard label="Locked Results"   value={lockedResults}   icon={<CheckCircle2 className="w-5 h-5" />} color="bg-green-50 text-green-600" border="border-green-100"/>
        {!hasLimitedManagement && (
          <StatCard label="Applicants" value={pendingApplicants} icon={<TrendingUp className="w-5 h-5" />} color="bg-red-50 text-red-600" border="border-red-100"/>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card card-body">
          <h2 className="section-title">Quick Actions</h2>
          <div className="space-y-2">
            {[
              ...(!hasLimitedManagement ? [
                { label:"Add New Student",     href:"/admin/users?role=student",  icon:GraduationCap },
                { label:"Add Teacher",         href:"/admin/users?role=teacher",  icon:Users },
                { label:"Create Class",        href:"/admin/classes",             icon:School },
              ] : []),
              { label:"Compile Class Results", href:"/admin/compile",             icon:BarChart2 },
              ...(!isNurseryHead ? [
                { label:"View CBT Exams",      href:"/admin/exams",               icon:ClipboardList },
              ] : []),
              ...(session.user.role === "SUPER_ADMIN" ? [
                { label:"View Audit Log",      href:"/admin/audit",               icon:Shield },
              ] : []),
            ].map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-ink transition-colors border border-transparent hover:border-border">
                <Icon className="w-4 h-4 text-brand-600 shrink-0"/>{label}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent audit log */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-ink text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-muted"/>Recent Activity</h2>
            <Link href="/admin/audit" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {recentAudit.length === 0 && (
              <div className="px-5 py-8 text-center text-muted text-sm">No activity yet.</div>
            )}
            {recentAudit.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`${actionBadge[log.action] ?? "badge-gray"} mt-0.5 shrink-0`}>{log.action}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink line-clamp-1">{log.description}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {log.user?.name ?? "System"} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    {log.ipAddress && log.ipAddress !== "unknown" && ` · ${log.ipAddress}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
