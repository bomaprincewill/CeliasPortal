import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Calendar, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { compareClasses, sortClasses } from "@/lib/classSorting";

type SearchParams = { date?: string; classId?: string };

const statusStyles = {
  PRESENT: "badge-green",
  ABSENT: "badge-red",
  LATE: "badge-yellow",
  EXCUSED: "badge-blue",
} as const;

const nameCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  const level = getLeadershipLevel(session.user.role);

  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")
    ? query.date!
    : new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${requestedDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${requestedDate}T00:00:00.000Z`);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  const classes = sortClasses(await prisma.class.findMany({
    where: {
      ...(currentSession ? { sessionId: currentSession.id } : {}),
      ...(level ? { level: { equals: level, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ name: "asc" }, { arm: "asc" }],
    include: { _count: { select: { students: true } } },
  }));
  const selectedClassId = classes.some((item) => item.id === query.classId) ? query.classId : undefined;

  const records = await prisma.attendance.findMany({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      ...(currentSession ? { sessionId: currentSession.id } : {}),
      ...(selectedClassId ? { classId: selectedClassId } : {}),
      ...(level ? { class: { level: { equals: level, mode: "insensitive" as const } } } : {}),
    },
    orderBy: [{ class: { name: "asc" } }, { student: { lastName: "asc" } }],
    include: {
      class: { select: { id: true, name: true, arm: true } },
      student: { select: { studentId: true, firstName: true, lastName: true } },
    },
  });
  records.sort((a, b) =>
    compareClasses(a.class, b.class)
    || nameCollator.compare(a.student.lastName, b.student.lastName)
    || nameCollator.compare(a.student.firstName, b.student.firstName)
  );

  const counts = {
    PRESENT: records.filter((item) => item.status === "PRESENT").length,
    ABSENT: records.filter((item) => item.status === "ABSENT").length,
    LATE: records.filter((item) => item.status === "LATE").length,
    EXCUSED: records.filter((item) => item.status === "EXCUSED").length,
  };
  const classCoverage = classes.map((schoolClass) => ({
    ...schoolClass,
    marked: records.filter((item) => item.classId === schoolClass.id).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {currentSession ? `${currentSession.name} attendance overview` : "No current academic session is configured"}
          </p>
        </div>
        <form className="card flex flex-wrap items-end gap-3 p-3" method="get">
          <label className="label-sm mb-0">
            Date
            <input name="date" type="date" defaultValue={requestedDate} className="input mt-1" />
          </label>
          <label className="label-sm mb-0">
            Class
            <select name="classId" defaultValue={selectedClassId ?? ""} className="input mt-1 min-w-40">
              <option value="">All classes</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} {schoolClass.arm}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">View attendance</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Present", value: counts.PRESENT, color: "text-emerald-600", Icon: CheckCircle2 },
          { label: "Absent", value: counts.ABSENT, color: "text-red-600", Icon: XCircle },
          { label: "Late", value: counts.LATE, color: "text-yellow-600", Icon: Clock },
          { label: "Excused", value: counts.EXCUSED, color: "text-blue-600", Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="card card-body flex items-center gap-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <div><div className="text-2xl font-bold text-ink">{value}</div><div className="text-xs text-muted">{label}</div></div>
          </div>
        ))}
      </div>

      {!selectedClassId && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {classCoverage.map((schoolClass) => (
            <a key={schoolClass.id} href={`?date=${requestedDate}&classId=${schoolClass.id}`} className="card card-body hover:border-brand-300">
              <div className="font-semibold text-ink">{schoolClass.name} {schoolClass.arm}</div>
              <div className="mt-1 text-xs text-muted">{schoolClass.marked} of {schoolClass._count.students} students marked</div>
            </a>
          ))}
        </div>
      )}

      <div className="table-container">
        {records.length === 0 ? (
          <div className="py-14 text-center text-muted">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-200" />
            No attendance was recorded for this selection.
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Student</th><th>Reg. No.</th><th>Class</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="font-medium">{record.student.lastName}, {record.student.firstName}</td>
                  <td className="font-mono text-xs">{record.student.studentId}</td>
                  <td>{record.class.name} {record.class.arm}</td>
                  <td><span className={statusStyles[record.status]}>{record.status}</span></td>
                  <td className="text-muted">{record.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
