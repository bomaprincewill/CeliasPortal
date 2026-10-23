import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AttendanceGrid from "@/components/attendance/AttendanceGrid";
import { attendanceDateSchema, termSchema } from "@/lib/attendanceValidation";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; term?: string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !["FORM_TEACHER","SUPER_ADMIN"].includes(session.user.role)) redirect("/teacher/dashboard");

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { formClassId: true } });
  const classId = teacher?.formClassId;
  if (!classId) return <div className="p-8 text-muted">You are not assigned as a form teacher to any class.</div>;

  const today = attendanceDateSchema.safeParse(query.date).success ? query.date! : new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const term = termSchema.safeParse(query.term).success ? termSchema.parse(query.term) : "FIRST";
  const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!currentSession) return <div className="p-8 text-muted">No current academic session is configured.</div>;

  const [classRecord, students, existing] = await Promise.all([
    prisma.class.findFirst({ where:{ id:classId, sessionId: currentSession.id }, select:{ name:true, arm:true } }),
    prisma.student.findMany({ where:{ isActive:true, enrollments: { some: { classId, sessionId: currentSession.id, status: "ACTIVE" } } }, orderBy:[{ lastName:"asc" },{ firstName:"asc" }], select:{ id:true, studentId:true, firstName:true, lastName:true } }),
    prisma.attendance.findMany({
      where:{ classId, sessionId: currentSession.id, term, date: new Date(today + "T00:00:00Z") },
      select:{ studentId:true, status:true, note:true, date:true },
    }),
  ]);

  if (!classRecord) return <div className="p-8 text-muted">Class not found.</div>;

  return (
    <AttendanceGrid
      key={`${classId}:${currentSession.id}:${term}:${today}`}
      classId={classId}
      className={`${classRecord.name} ${classRecord.arm}`}
      sessionId={currentSession.id}
      term={term}
      initialDate={today}
      students={students}
      existing={existing.map(e => ({ ...e, date: e.date.toISOString().split("T")[0], note: e.note ?? "" }))}
    />
  );
}
