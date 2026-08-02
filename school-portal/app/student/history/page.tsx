import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/studentAccess";
import { TERM_LABELS, type Term } from "@/types";

export default async function StudentHistoryPage() {
  let student; try { ({ student } = await requireStudentProfile()); } catch { redirect("/auth/signin"); }
  const summaries = await prisma.broadSheet.findMany({ where: { studentId: student.id }, orderBy: [{ computedAt: "desc" }] });
  const sessionIds = [...new Set(summaries.map(item => item.sessionId))];
  const sessions = await prisma.academicSession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, name: true } });
  const names = new Map(sessions.map(item => [item.id, item.name]));
  return <div className="space-y-6"><div><h1 className="page-title">Academic History</h1><p className="page-subtitle">Approved report summaries across academic sessions.</p></div><div className="table-container"><table className="data-table"><thead><tr><th>Session</th><th>Term</th><th>Average</th><th>Position</th><th>Status</th><th></th></tr></thead><tbody>
    {summaries.map(item => <tr key={item.id}><td>{names.get(item.sessionId) ?? item.sessionId}</td><td>{TERM_LABELS[item.term as Term]}</td><td>{item.averageScore.toFixed(1)}%</td><td>{item.position ?? "—"}/{item.outOf ?? "—"}</td><td><span className={item.isLocked ? "badge-green" : "badge-yellow"}>{item.isLocked ? "Official" : "Compiled"}</span></td><td className="text-right"><Link className="btn-ghost btn-sm" href={`/student/report?sessionId=${item.sessionId}&term=${item.term}`}>View report</Link></td></tr>)}
    {!summaries.length && <tr><td colSpan={6} className="py-10 text-center text-muted">No compiled academic history yet.</td></tr>}
  </tbody></table></div></div>;
}
