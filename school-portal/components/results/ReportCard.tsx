// components/results/ReportCard.tsx
// Printable HTML report card (also used as PDF source)
// Renders server-side; use window.print() or /api/report/[id] for PDF

import { assignGrade, gradeBg, TERM_LABELS } from "@/types";
import type { Term } from "@/types";

interface SubjectResult {
  subjectName: string;
  subjectCode: string;
  ca1: number | null; ca2: number | null; ca3: number | null;
  examScore: number | null; total: number | null;
  grade: string | null; remark: string | null; position: number | null;
  maxCA1: number; maxCA2: number; maxCA3: number; maxExam: number; maxTotal: number;
}

interface ReportCardProps {
  school: { name: string; address: string; motto?: string; logoUrl?: string };
  student: { name: string; studentId: string; className: string; gender: string; dateOfBirth: string; photoUrl?: string };
  session: string;
  term: Term;
  results: SubjectResult[];
  summary: { totalScore: number; averageScore: number; position: number; outOf: number; isLocked: boolean };
  formTeacherComment?: string;
  principalComment?: string;
  attendance?: { present: number; absent: number; late: number; total: number };
  nextTermBegins?: string;
  isLocked?: boolean;
}

function scoreBg(total: number | null, max: number) {
  if (!total) return "";
  const pct = (total / max) * 100;
  if (pct >= 75) return "bg-emerald-50";
  if (pct >= 40) return "";
  return "bg-red-50";
}

export default function ReportCard({
  school, student, session, term, results, summary,
  formTeacherComment, principalComment, attendance, nextTermBegins, isLocked,
}: ReportCardProps) {
  const totalMaxMarks = results.reduce((sum, r) => sum + r.maxTotal, 0);

  return (
    <div className="print-page mx-auto max-w-3xl overflow-x-auto border border-border bg-white p-4 font-sans text-ink shadow-sm sm:p-8">
      {/* School header */}
      <div className="text-center border-b-4 border-brand-950 pb-4 mb-6">
        {school.logoUrl && (
          <img src={school.logoUrl} alt="School Logo" className="w-20 h-20 object-contain mx-auto mb-2"/>
        )}
        <h1 className="font-display text-2xl font-bold text-brand-950 uppercase tracking-wide">{school.name}</h1>
        <p className="text-sm text-muted mt-1">{school.address}</p>
        {school.motto && <p className="text-xs italic text-muted mt-0.5">"{school.motto}"</p>}
        <div className="mt-3 inline-flex items-center gap-2 bg-brand-950 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
          STUDENT REPORT CARD — {TERM_LABELS[term].toUpperCase()} · {session}
        </div>
      </div>

      {/* Student info */}
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-border bg-slate-50 p-4 sm:grid-cols-3 sm:gap-4">
        <div className="col-span-2 grid grid-cols-2 gap-3 text-sm">
          {[
            ["Student Name",  student.name],
            ["Student ID",    student.studentId],
            ["Class",         student.className],
            ["Gender",        student.gender],
            ["Date of Birth", student.dateOfBirth],
            ["Academic Year", session],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-xs text-muted block">{label}</span>
              <span className="font-semibold text-ink">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center">
          {student.photoUrl ? (
            <img src={student.photoUrl} alt="Student" className="w-24 h-28 object-cover rounded-lg border-2 border-border"/>
          ) : (
            <div className="w-24 h-28 rounded-lg bg-brand-50 border-2 border-border flex items-center justify-center text-brand-600 text-3xl font-bold">
              {student.name.charAt(0)}
            </div>
          )}
          {isLocked && <span className="text-xs mt-1 badge-green">🔒 Official</span>}
        </div>
      </div>

      {/* Results table */}
      <table className="w-full text-xs border-collapse mb-6">
        <thead>
          <tr className="bg-brand-950 text-white">
            <th className="px-3 py-2.5 text-left">Subject</th>
            <th className="px-2 py-2.5 text-center">CA1<br/><span className="font-normal opacity-70">/{results[0]?.maxCA1 ?? 10}</span></th>
            <th className="px-2 py-2.5 text-center">CA2<br/><span className="font-normal opacity-70">/{results[0]?.maxCA2 ?? 10}</span></th>
            <th className="px-2 py-2.5 text-center">CA3<br/><span className="font-normal opacity-70">/{results[0]?.maxCA3 ?? 10}</span></th>
            <th className="px-2 py-2.5 text-center">Exam<br/><span className="font-normal opacity-70">/{results[0]?.maxExam ?? 70}</span></th>
            <th className="px-2 py-2.5 text-center font-bold">Total<br/><span className="font-normal opacity-70">/{results[0]?.maxTotal ?? 100}</span></th>
            <th className="px-2 py-2.5 text-center">Grade</th>
            <th className="px-2 py-2.5 text-center">Remark</th>
            <th className="px-2 py-2.5 text-center">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.subjectCode} className={`border-b border-slate-200 ${i%2===0?"":"bg-slate-50/50"} ${scoreBg(r.total, r.maxTotal)}`}>
              <td className="px-3 py-2">
                <span className="font-medium">{r.subjectName}</span>
                <span className="text-slate-400 ml-1 text-xs">({r.subjectCode})</span>
              </td>
              <td className="px-2 py-2 text-center">{r.ca1 ?? "—"}</td>
              <td className="px-2 py-2 text-center">{r.ca2 ?? "—"}</td>
              <td className="px-2 py-2 text-center">{r.ca3 ?? "—"}</td>
              <td className="px-2 py-2 text-center">{r.examScore ?? "—"}</td>
              <td className="px-2 py-2 text-center font-bold">{r.total ?? "—"}</td>
              <td className="px-2 py-2 text-center">
                {r.grade && <span className={`badge rounded border text-xs px-1.5 py-0 ${gradeBg(r.grade)}`}>{r.grade}</span>}
              </td>
              <td className="px-2 py-2 text-center text-slate-600">{r.remark ?? "—"}</td>
              <td className="px-2 py-2 text-center text-slate-500">{r.position ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-brand-950 text-white">
            <td className="px-3 py-2.5 font-semibold">SUMMARY</td>
            <td colSpan={4} className="px-2 py-2.5 text-center text-xs">
              Total Marks Obtainable: {totalMaxMarks}
            </td>
            <td className="px-2 py-2.5 text-center font-bold">{summary.totalScore.toFixed(0)}</td>
            <td colSpan={2} className="px-2 py-2.5 text-center">Avg: {summary.averageScore.toFixed(1)}%</td>
            <td className="px-2 py-2.5 text-center font-bold">{summary.position}<sup>{summary.position===1?"st":summary.position===2?"nd":summary.position===3?"rd":"th"}</sup>/{summary.outOf}</td>
          </tr>
        </tfoot>
      </table>

      {/* Grading key */}
      <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-border">
        <p className="text-xs font-semibold text-ink mb-2">Grading Scale</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["A","75–100","Distinction"],["B","65–74","Credit"],["C","55–64","Merit"],
            ["D","45–54","Pass"],["E","40–44","Weak Pass"],["F","0–39","Fail"],
          ].map(([g,r,l])=>(
            <div key={g} className={`px-2 py-1 rounded border ${gradeBg(g)}`}>
              <span className="font-bold">{g}</span> = {r} ({l})
            </div>
          ))}
        </div>
      </div>

      {/* Attendance */}
      {attendance && (
        <div className="mb-4 grid grid-cols-2 gap-3 text-center text-xs sm:grid-cols-4">
          {[
            ["Days in Term",   attendance.total,   "text-ink"],
            ["Days Present",   attendance.present, "text-emerald-600"],
            ["Days Absent",    attendance.absent,  "text-red-600"],
            ["Days Late",      attendance.late,    "text-yellow-600"],
          ].map(([label, value, color])=>(
            <div key={label} className="bg-slate-50 rounded-xl border border-border p-3">
              <div className={`font-display text-lg font-bold ${color}`}>{value}</div>
              <div className="text-muted">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Comments */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted mb-1">Form Teacher's Comment</p>
          <p className="text-xs text-ink italic min-h-[3rem]">{formTeacherComment ?? "—"}</p>
          <div className="mt-3 border-t border-border pt-2">
            <div className="h-6 border-b border-dashed border-slate-300"/>
            <p className="text-xs text-muted mt-1">Signature</p>
          </div>
        </div>
        <div className="border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted mb-1">Principal's Comment</p>
          <p className="text-xs text-ink italic min-h-[3rem]">{principalComment ?? "Keep up the good work!"}</p>
          <div className="mt-3 border-t border-border pt-2">
            <div className="h-6 border-b border-dashed border-slate-300"/>
            <p className="text-xs text-muted mt-1">Signature & Stamp</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-brand-950 pt-3 flex items-center justify-between text-xs text-muted">
        <span>Next Term Begins: <strong className="text-ink">{nextTermBegins ?? "TBD"}</strong></span>
        <span>Generated: {new Date().toLocaleDateString("en-NG", { day:"numeric", month:"long", year:"numeric" })}</span>
        <span className="font-mono">{student.studentId}</span>
      </div>
    </div>
  );
}
