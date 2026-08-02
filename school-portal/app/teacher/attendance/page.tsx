import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AttendanceGrid from "@/components/attendance/AttendanceGrid";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !["FORM_TEACHER","SUPER_ADMIN"].includes(session.user.role)) redirect("/teacher/dashboard");

  const classId = session.user.formClassId;
  if (!classId) return <div className="p-8 text-muted">You are not assigned as a form teacher to any class.</div>;

  const today = query.date ?? new Date().toISOString().split("T")[0];

  const [classRecord, students, existing, currentSession] = await Promise.all([
    prisma.class.findUnique({ where:{ id:classId }, select:{ name:true, arm:true } }),
    prisma.student.findMany({ where:{ classId, isActive:true }, orderBy:[{ lastName:"asc" },{ firstName:"asc" }], select:{ id:true, studentId:true, firstName:true, lastName:true } }),
    prisma.attendance.findMany({
      where:{ classId, date:{ gte: new Date(today + "T00:00:00Z"), lte: new Date(today + "T23:59:59Z") } },
      select:{ studentId:true, status:true, note:true, date:true },
    }),
    prisma.academicSession.findFirst({ where:{ isCurrent:true }, select:{ id:true, name:true } }),
  ]);

  if (!classRecord) return <div className="p-8 text-muted">Class not found.</div>;

  return (
    <AttendanceGrid
      classId={classId}
      className={`${classRecord.name} ${classRecord.arm}`}
      sessionId={currentSession?.id ?? ""}
      term="FIRST"
      initialDate={today}
      students={students}
      existing={existing.map(e => ({ ...e, status: e.status as any, date: e.date.toISOString().split("T")[0], note: e.note ?? "" }))}
    />
  );
}
