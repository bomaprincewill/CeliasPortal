"use client";
import { useState, useTransition } from "react";
import { Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Toast } from "@/components/ui";
import { cn } from "@/components/ui";
import type { AttendanceStatus } from "@/types";

interface StudentAttRow {
  studentId: string;
  studentNo: string;
  name:      string;
  status:    AttendanceStatus;
  note:      string;
  existing:  boolean;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label:string; color:string; icon: React.ElementType; short:string }> = {
  PRESENT: { label:"Present", color:"bg-emerald-50 border-emerald-300 text-emerald-700", icon:CheckCircle2, short:"P" },
  ABSENT:  { label:"Absent",  color:"bg-red-50 border-red-300 text-red-700",             icon:XCircle,      short:"A" },
  LATE:    { label:"Late",    color:"bg-yellow-50 border-yellow-300 text-yellow-700",    icon:Clock,        short:"L" },
  EXCUSED: { label:"Excused", color:"bg-blue-50 border-blue-300 text-blue-700",          icon:AlertTriangle,short:"E" },
};

interface Props {
  classId:   string;
  className: string;
  sessionId: string;
  term:      string;
  initialDate: string;
  students:  { id:string; studentId:string; firstName:string; lastName:string }[];
  existing:  { studentId:string; status:AttendanceStatus; note:string; date:string }[];
}

export default function AttendanceGrid({ classId, className, sessionId, term, initialDate, students, existing }: Props) {
  const [date, setDate]     = useState(initialDate);
  const [isPending, start]  = useTransition();
  const [toast, setToast]   = useState<any>(null);
  const [markAll, setMarkAll]= useState<AttendanceStatus | null>(null);

  const existingMap = new Map(existing.filter(e=>e.date===date).map(e=>[e.studentId, e]));

  const [rows, setRows] = useState<StudentAttRow[]>(() =>
    students.map(s => {
      const ex = existingMap.get(s.id);
      return {
        studentId: s.id, studentNo: s.studentId,
        name: `${s.lastName}, ${s.firstName}`,
        status: ex?.status ?? "PRESENT",
        note: ex?.note ?? "",
        existing: !!ex,
      };
    })
  );

  const updateRow = (studentId: string, field: "status"|"note", value: string) => {
    setRows(prev => prev.map(r => r.studentId===studentId ? { ...r, [field]:value } : r));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setRows(prev => prev.map(r => ({ ...r, status })));
    setMarkAll(status);
  };

  const handleSave = () => {
    start(async () => {
      // In production: call server action markAttendance
      await new Promise(r => setTimeout(r, 800));
      setToast({ type:"success", message:`Attendance saved for ${date} (${rows.length} students).` });
    });
  };

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  const counts = {
    PRESENT: rows.filter(r=>r.status==="PRESENT").length,
    ABSENT:  rows.filter(r=>r.status==="ABSENT").length,
    LATE:    rows.filter(r=>r.status==="LATE").length,
    EXCUSED: rows.filter(r=>r.status==="EXCUSED").length,
  };

  return (
    <div className="space-y-5">
      {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Attendance Register</h1>
          <p className="page-subtitle">{className}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 card card-body py-2 px-3">
            <button onClick={()=>shiftDate(-1)} className="btn-ghost btn-icon btn-sm"><ChevronLeft className="w-4 h-4"/></button>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="text-sm font-medium text-ink border-0 outline-none bg-transparent cursor-pointer"/>
            <button onClick={()=>shiftDate(1)} className="btn-ghost btn-icon btn-sm"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <button onClick={handleSave} disabled={isPending} className="btn-primary gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
            Save
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["PRESENT","ABSENT","LATE","EXCUSED"] as AttendanceStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className={cn("card border rounded-xl p-3 text-center cursor-pointer transition-all", cfg.color, markAll===s?"ring-2 ring-offset-1 ring-current":"hover:shadow-sm")}
              onClick={()=>handleMarkAll(s)}>
              <div className="font-display text-xl font-bold">{counts[s]}</div>
              <div className="text-xs font-medium mt-0.5 flex items-center justify-center gap-1">
                <Icon className="w-3 h-3"/>{cfg.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mark all row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted font-medium">Mark all as:</span>
        {(["PRESENT","ABSENT","LATE","EXCUSED"] as AttendanceStatus[]).map(s=>(
          <button key={s} onClick={()=>handleMarkAll(s)}
            className={cn("btn-sm border-2 font-semibold text-xs rounded-full px-3", STATUS_CONFIG[s].color)}>
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Attendance table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="w-28">Reg. No.</th>
              <th>Student Name</th>
              {(["PRESENT","ABSENT","LATE","EXCUSED"] as AttendanceStatus[]).map(s=>(
                <th key={s} className="text-center w-24">{STATUS_CONFIG[s].short} — {STATUS_CONFIG[s].label}</th>
              ))}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.studentId} className={row.status==="ABSENT"?"bg-red-50/40":row.status==="LATE"?"bg-yellow-50/40":""}>
                <td className="text-muted text-xs">{i+1}</td>
                <td className="font-mono text-xs text-muted">{row.studentNo}</td>
                <td className="font-medium">{row.name}</td>
                {(["PRESENT","ABSENT","LATE","EXCUSED"] as AttendanceStatus[]).map(s=>(
                  <td key={s} className="text-center">
                    <button
                      onClick={()=>updateRow(row.studentId,"status",s)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto text-xs font-bold transition-all",
                        row.status===s ? STATUS_CONFIG[s].color+" ring-2 ring-offset-1 ring-current" : "border-border text-muted hover:border-slate-300"
                      )}>
                      {STATUS_CONFIG[s].short}
                    </button>
                  </td>
                ))}
                <td>
                  <input
                    value={row.note}
                    onChange={e=>updateRow(row.studentId,"note",e.target.value)}
                    placeholder="Optional note…"
                    className="input text-xs py-1 h-8"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total: {rows.length} students</td>
              {(["PRESENT","ABSENT","LATE","EXCUSED"] as AttendanceStatus[]).map(s=>(
                <td key={s} className="text-center font-bold">{counts[s]}</td>
              ))}
              <td/>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
