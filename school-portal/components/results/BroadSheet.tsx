"use client";
import { useState } from "react";
import { Download, Trophy, TrendingUp, TrendingDown, Search, Printer } from "lucide-react";
import { cn } from "@/components/ui";
import { assignGrade, gradeBg, TERM_LABELS } from "@/types";
import type { Term } from "@/types";

interface SubjectCol { id:string; name:string; code:string }
interface StudentRow {
  studentId: string; studentNo: string; name: string;
  scores:    Record<string, { total:number; grade:string } | null>;
  cumulative: number; average: number; position: number; outOf: number;
}

interface Props {
  classId:   string; className: string;
  sessionName: string; term: Term;
  subjects:  SubjectCol[];
  students:  StudentRow[];
  isLocked:  boolean;
}

export default function BroadSheet({ classId, className, sessionName, term, subjects, students, isLocked }: Props) {
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  const visible = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.studentNo.includes(search)
  );

  const classAvg = students.length > 0
    ? (students.reduce((sum,s)=>sum+s.average,0)/students.length).toFixed(1)
    : "0";

  const handlePrint = () => window.print();

  const passCount  = students.filter(s=>s.average>=40).length;
  const passRate   = students.length > 0 ? Math.round(passCount/students.length*100) : 0;

  const cellColor = (total: number | undefined) => {
    if (total == null) return "text-muted";
    if (total >= 75) return "text-emerald-700 font-semibold";
    if (total >= 40) return "text-ink";
    return "text-red-600 font-semibold";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="page-title">Broad Sheet</h1>
          <p className="page-subtitle">{className} · {TERM_LABELS[term]} · {sessionName}</p>
          {isLocked && <span className="badge-green mt-1 inline-flex">🔒 Results Locked</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="input pl-9 max-w-48"/>
          </div>
          <button onClick={handlePrint} className="btn-secondary btn-sm gap-2 no-print">
            <Printer className="w-3.5 h-3.5"/> Print
          </button>
          <button className="btn-primary btn-sm gap-2 no-print">
            <Download className="w-3.5 h-3.5"/> Export Excel
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {[
          { label:"Students",    value:students.length,  icon:null,        color:"text-ink" },
          { label:"Class Avg",   value:`${classAvg}%`,   icon:TrendingUp,  color:"text-brand-600" },
          { label:"Pass Rate",   value:`${passRate}%`,   icon:TrendingUp,  color:passRate>=50?"text-emerald-600":"text-red-600" },
          { label:"Subjects",    value:subjects.length,  icon:null,        color:"text-ink" },
        ].map(({ label, value, icon:Icon, color }) => (
          <div key={label} className="card card-body py-3">
            <div className={cn("font-display text-2xl font-bold", color)}>{value}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Print header (only shows on print) */}
      <div className="hidden print:block text-center py-4">
        <h1 className="font-display text-2xl font-bold">Broad Sheet — {className}</h1>
        <p className="text-sm">{TERM_LABELS[term]} · {sessionName}</p>
      </div>

      {/* Broad sheet table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-brand-950 text-white">
                <th className="px-3 py-3 text-left sticky left-0 bg-brand-950 z-10 w-6">#</th>
                <th className="px-3 py-3 text-left sticky left-6 bg-brand-950 z-10 min-w-[80px]">Reg. No.</th>
                <th className="px-3 py-3 text-left sticky left-24 bg-brand-950 z-10 min-w-[160px]">Student Name</th>
                {subjects.map(s => (
                  <th key={s.id}
                    className={cn("px-2 py-3 text-center min-w-[70px] cursor-pointer hover:bg-white/10 transition-colors", highlight===s.id && "bg-brand-700")}
                    onClick={()=>setHighlight(highlight===s.id?null:s.id)}>
                    <div className="font-bold">{s.code}</div>
                    <div className="font-normal text-brand-300 text-xs whitespace-nowrap">{s.name}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center min-w-[70px] bg-brand-800">Total</th>
                <th className="px-3 py-3 text-center min-w-[60px] bg-brand-800">Avg</th>
                <th className="px-3 py-3 text-center min-w-[60px] bg-brand-800">Pos</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={subjects.length+6} className="px-4 py-8 text-center text-muted">No students found.</td></tr>
              )}
              {visible.map((row, i) => {
                const grade = assignGrade(row.average);
                const isTop = row.position === 1;
                return (
                  <tr key={row.studentId}
                    className={cn("border-b border-border hover:bg-slate-50 transition-colors", isTop && "bg-yellow-50/50", i%2===0?"":"bg-slate-50/30")}>
                    <td className="px-3 py-2.5 text-muted sticky left-0 bg-inherit">
                      {isTop && <Trophy className="w-3.5 h-3.5 text-yellow-500 inline"/>}
                      {!isTop && i+1}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted sticky left-6 bg-inherit">{row.studentNo}</td>
                    <td className="px-3 py-2.5 font-medium text-ink sticky left-24 bg-inherit whitespace-nowrap">{row.name}</td>
                    {subjects.map(s => {
                      const score = row.scores[s.id];
                      return (
                        <td key={s.id} className={cn("px-2 py-2.5 text-center", highlight===s.id?"bg-brand-50":"")}>
                          {score ? (
                            <div>
                              <div className={cellColor(score.total)}>{score.total}</div>
                              <div className={cn("text-xs", gradeBg(score.grade), "badge rounded px-1 py-0 border")}>{score.grade}</div>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-bold bg-brand-50/30">
                      <span className={cellColor(row.cumulative)}>{row.cumulative}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold bg-brand-50/30">
                      <span className={cellColor(row.average)}>{row.average.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center bg-brand-50/30">
                      <span className={cn("font-bold", row.position<=3?"text-yellow-600":"text-ink")}>
                        {row.position}<sup>{row.position===1?"st":row.position===2?"nd":row.position===3?"rd":"th"}</sup>
                      </span>
                      <div className="text-muted text-xs">/{row.outOf}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-border">
                <td colSpan={3} className="px-3 py-3 text-xs font-semibold text-muted">
                  CLASS SUMMARY — {students.length} students
                </td>
                {subjects.map(s => {
                  const subjectScores = students.map(st=>st.scores[s.id]?.total).filter(v=>v!=null) as number[];
                  const avg = subjectScores.length>0 ? (subjectScores.reduce((a,b)=>a+b,0)/subjectScores.length).toFixed(1) : "—";
                  return (
                    <td key={s.id} className="px-2 py-3 text-center">
                      <div className="font-bold text-xs">{avg}</div>
                      <div className="text-xs text-muted">avg</div>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center font-bold text-xs bg-brand-50/30">—</td>
                <td className="px-3 py-3 text-center font-bold text-xs bg-brand-50/30">{classAvg}</td>
                <td className="px-3 py-3 bg-brand-50/30"/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
