import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/studentAccess";
import { TERM_LABELS, type Term } from "@/types";

export default async function StudentAttendancePage() {
  let student; try { ({ student } = await requireStudentProfile()); } catch { redirect("/auth/signin"); }
  const grouped = await prisma.attendance.groupBy({ by: ["sessionId", "term", "status"], where: { studentId: student.id }, _count: { status: true } });
  const sessions = await prisma.academicSession.findMany({ where: { id: { in: [...new Set(grouped.map(item => item.sessionId))] } }, select: { id: true, name: true } });
  const names = new Map(sessions.map(item => [item.id, item.name]));
  const rows = new Map<string, Record<string, number>>();
  grouped.forEach(item => { const key = `${item.sessionId}:${item.term}`; rows.set(key, { ...(rows.get(key) ?? {}), [item.status]: item._count.status }); });
  return <div className="space-y-6"><div><h1 className="page-title">Attendance History</h1><p className="page-subtitle">Your recorded attendance by session and term.</p></div><div className="table-container"><table className="data-table"><thead><tr><th>Session</th><th>Term</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr></thead><tbody>{[...rows].map(([key, counts]) => { const [sessionId, term] = key.split(":"); const total = Object.values(counts).reduce((a,b)=>a+b,0); return <tr key={key}><td>{names.get(sessionId)}</td><td>{TERM_LABELS[term as Term]}</td><td>{counts.PRESENT ?? 0}</td><td>{counts.ABSENT ?? 0}</td><td>{counts.LATE ?? 0}</td><td>{counts.EXCUSED ?? 0}</td><td>{total ? Math.round((counts.PRESENT ?? 0) / total * 100) : 0}%</td></tr>;})}{!rows.size && <tr><td colSpan={7} className="py-10 text-center text-muted">No attendance has been recorded.</td></tr>}</tbody></table></div></div>;
}
