import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart2, Calendar, ClipboardList, FileText, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/studentAccess";
import { StatCard } from "@/components/ui";

export default async function StudentDashboard() {
  let context;
  try { context = await requireStudentProfile(); } catch { redirect("/auth/signin"); }
  const { session, student } = context;
  const currentSession = student.class?.session ?? await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  const [latest, attendance, upcomingExams] = await Promise.all([
    prisma.broadSheet.findFirst({ where: { studentId: student.id, sessionId: currentSession?.id ?? "" }, orderBy: { computedAt: "desc" } }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId: student.id, sessionId: currentSession?.id ?? "" }, _count: { status: true } }),
    prisma.exam.count({ where: { classId: student.classId, isPublished: true, scheduledEnd: { gte: new Date() } } }),
  ]);
  const present = attendance.find(item => item.status === "PRESENT")?._count.status ?? 0;
  const totalAttendance = attendance.reduce((sum, item) => sum + item._count.status, 0);
  return <div className="space-y-7">
    <div><h1 className="page-title">Welcome, {session.user.name.split(" ")[0]}</h1><p className="page-subtitle">{student.class ? `${student.class.name} ${student.class.arm}` : "No current class"} · {student.studentId}</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Latest average" value={latest ? `${latest.averageScore.toFixed(1)}%` : "—"} icon={<BarChart2 className="h-5 w-5"/>}/>
      <StatCard label="Class position" value={latest?.position ? `${latest.position}/${latest.outOf}` : "—"} icon={<GraduationCap className="h-5 w-5"/>}/>
      <StatCard label="Attendance" value={totalAttendance ? `${Math.round(present / totalAttendance * 100)}%` : "—"} icon={<Calendar className="h-5 w-5"/>}/>
      <StatCard label="Upcoming exams" value={upcomingExams} icon={<ClipboardList className="h-5 w-5"/>}/>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {[{ href:"/student/history", title:"Academic history", text:"Results and report cards from every session", icon:FileText },{ href:"/student/attendance", title:"Attendance", text:"Your attendance record by term", icon:Calendar },{ href:"/student/exams", title:"CBT exams", text:"Available and completed online exams", icon:ClipboardList }].map(({href,title,text,icon:Icon}) => <Link key={href} href={href} className="card card-body hover:border-brand-300"><Icon className="h-6 w-6 text-brand-600"/><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{text}</p></Link>)}
    </div>
  </div>;
}
