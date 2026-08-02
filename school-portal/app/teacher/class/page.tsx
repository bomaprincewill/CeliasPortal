import Link from "next/link";
import { redirect } from "next/navigation";
import { BookMarked, Calendar, School, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui";

export default async function FormTeacherClassPage() {
  const session = await getSession();
  if (!session || session.user.role !== "FORM_TEACHER") {
    redirect("/teacher/dashboard");
  }

  const classId = session.user.formClassId;
  if (!classId) {
    return (
      <div className="card card-body py-12 text-center">
        <School className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <h1 className="text-lg font-semibold text-ink">No class assigned</h1>
        <p className="mt-1 text-sm text-muted">
          Ask an administrator to assign you as a form teacher.
        </p>
      </div>
    );
  }

  const [schoolClass, pupils, assignments, attendanceToday] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, formTeacher: { userId: session.user.id } },
      include: { session: { select: { name: true, isCurrent: true } } },
    }),
    prisma.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        studentId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        dateOfBirth: true,
      },
    }),
    prisma.subjectAssignment.findMany({
      where: { classId },
      distinct: ["subjectId"],
      orderBy: { subject: { name: "asc" } },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    }),
    prisma.attendance.count({
      where: {
        classId,
        status: "PRESENT",
        date: {
          gte: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
          lt: new Date(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) + "T00:00:00.000Z"),
        },
      },
    }),
  ]);

  if (!schoolClass) redirect("/teacher/dashboard");

  const usesPupilTerminology = ["nursery", "primary"].includes(schoolClass.level.toLowerCase());
  const learnerSingular = usesPupilTerminology ? "Pupil" : "Student";
  const learnerPlural = usesPupilTerminology ? "Pupils" : "Students";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">My Class</h1>
          <p className="page-subtitle">
            {schoolClass.name} {schoolClass.arm} · {schoolClass.session.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/teacher/attendance" className="btn-secondary btn-sm">
            <Calendar className="h-4 w-4" /> Attendance
          </Link>
          <Link href="/teacher/results" className="btn-primary btn-sm">
            View Results
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={learnerPlural}
          value={pupils.length}
          icon={<Users className="h-5 w-5" />}
          color="bg-brand-50 text-brand-600"
          border="border-brand-100"
        />
        <StatCard
          label="Subjects"
          value={assignments.length}
          icon={<BookMarked className="h-5 w-5" />}
          color="bg-purple-50 text-purple-600"
          border="border-purple-100"
        />
        <StatCard
          label="Present Today"
          value={attendanceToday}
          icon={<Calendar className="h-5 w-5" />}
          color="bg-emerald-50 text-emerald-600"
          border="border-emerald-100"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-ink">{learnerPlural} Roster</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Admission No.</th>
                  <th>{learnerSingular} Name</th>
                  <th>Gender</th>
                  <th>Date of Birth</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((pupil, index) => (
                  <tr key={pupil.id}>
                    <td>{index + 1}</td>
                    <td className="font-mono text-xs">{pupil.studentId}</td>
                    <td className="font-medium text-ink">
                      {pupil.lastName}, {pupil.firstName}{pupil.middleName ? ` ${pupil.middleName}` : ""}
                    </td>
                    <td className="capitalize">{pupil.gender.toLowerCase()}</td>
                    <td>{pupil.dateOfBirth.toLocaleDateString("en-NG")}</td>
                  </tr>
                ))}
                {pupils.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted">
                      No {learnerPlural.toLowerCase()} are assigned to this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-ink">Subject Teachers</h2>
          </div>
          <div className="divide-y divide-border">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{assignment.subject.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{assignment.teacher.user.name}</p>
                  </div>
                  <span className="badge-blue">{assignment.subject.code}</span>
                </div>
              </div>
            ))}
            {assignments.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted">
                No subjects assigned.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
