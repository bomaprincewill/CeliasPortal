import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/ui";
import { BarChart2, BookMarked, Users, CheckCircle2, Clock, Calendar } from "lucide-react";
import { ROLE_LABELS } from "@/types";
import { compareClasses } from "@/lib/classSorting";

export default async function TeacherDashboard() {
  const session = await getSession();
  if (!session || !["FORM_TEACHER","SUBJECT_TEACHER","SUPER_ADMIN"].includes(session.user.role)) redirect("/auth/signin");

  const currentSession = await prisma.academicSession.findFirst({ where:{ isCurrent:true } });
  const isFormTeacher  = session.user.role === "FORM_TEACHER";

  const [myDraftCount, mySubmittedCount, studentsInClass, todayAttendance] = await Promise.all([
    prisma.result.count({
      where: {
        status: "DRAFT",
        ...(isFormTeacher
          ? { classId: session.user.formClassId ?? "NONE" }
          : { subjectId: { in: session.user.assignedSubjectIds ?? [] }, classId: { in: session.user.assignedClassIds ?? [] } }),
      },
    }),
    prisma.result.count({
      where: {
        status: "SUBMITTED",
        ...(isFormTeacher
          ? { classId: session.user.formClassId ?? "NONE" }
          : { subjectId: { in: session.user.assignedSubjectIds ?? [] } }),
      },
    }),
    isFormTeacher && session.user.formClassId
      ? prisma.student.count({ where: { classId: session.user.formClassId, isActive:true } })
      : Promise.resolve(0),
    isFormTeacher && session.user.formClassId
      ? prisma.attendance.count({
          where: { classId: session.user.formClassId, date: new Date(new Date().toDateString()), status:"PRESENT" },
        })
      : Promise.resolve(0),
  ]);

  const myAssignments = await prisma.subjectAssignment.findMany({
    where: { teacherId: (await prisma.teacher.findFirst({ where:{ userId: session.user.id } }))?.id ?? "" },
    include: { subject:{ select:{name:true,code:true} }, class:{ select:{name:true,arm:true} } },
    take: 10,
  });
  myAssignments.sort((a, b) =>
    compareClasses(a.class, b.class) || a.subject.name.localeCompare(b.subject.name)
  );

  const welcomeName = session.user.name?.trim() || ROLE_LABELS[session.user.role];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Welcome, {welcomeName}
        </h1>
        <p className="text-muted mt-1">
          {session.user.role === "FORM_TEACHER" ? "Form Teacher" : "Subject Teacher"}
          {currentSession ? ` · ${currentSession.name}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Draft Scores"     value={myDraftCount}    icon={<Clock className="w-5 h-5" />}        color="bg-yellow-50 text-yellow-600"  border="border-yellow-100"/>
        <StatCard label="Pending Approval" value={mySubmittedCount} icon={<CheckCircle2 className="w-5 h-5" />} color="bg-brand-50 text-brand-600"    border="border-brand-100"/>
        {isFormTeacher && <>
          <StatCard label="Students in Class"   value={studentsInClass} icon={<Users className="w-5 h-5" />}     color="bg-emerald-50 text-emerald-600" border="border-emerald-100"/>
          <StatCard label="Present Today"       value={todayAttendance} icon={<Calendar className="w-5 h-5" />}  color="bg-purple-50 text-purple-600"   border="border-purple-100"/>
        </>}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My assignments */}
        <div className="card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-ink text-sm flex items-center gap-2"><BookMarked className="w-4 h-4 text-muted"/>My Assignments</h2>
          </div>
          <div className="divide-y divide-border">
            {myAssignments.length === 0 && <div className="px-5 py-8 text-center text-muted text-sm">No assignments yet.</div>}
            {myAssignments.map(a => (
              <Link key={a.id} href={`/teacher/results/${a.classId}/${a.subjectId}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-ink">{a.subject.name}</div>
                  <div className="text-xs text-muted mt-0.5">{a.class.name} {a.class.arm}</div>
                </div>
                <span className="badge-blue">{a.subject.code}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card card-body">
          <h2 className="section-title">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label:"Enter Scores",        href:"/teacher/results",    icon:BarChart2 },
              ...(isFormTeacher ? [
                { label:"Mark Attendance",   href:"/teacher/attendance", icon:Calendar },
                { label:"View Broad Sheet",  href:"/teacher/broadsheet", icon:BarChart2 },
              ] : []),
            ].map(({ label, href, icon:Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm text-ink transition-colors border border-transparent hover:border-border">
                <Icon className="w-4 h-4 text-brand-600 shrink-0"/>{label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
