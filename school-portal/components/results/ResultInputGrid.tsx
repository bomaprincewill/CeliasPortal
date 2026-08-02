"use client";
// components/results/ResultInputGrid.tsx
// ============================================================
// Excel-style score entry grid for Subject Teachers.
// Features:
//  - Keyboard navigation (Tab, Shift+Tab, Arrow keys, Enter)
//  - Live total calculation
//  - Per-cell validation with visual error states
//  - Unsaved-changes warning
//  - Save Draft + Submit for Approval actions
//  - Paste from clipboard (Excel/Sheets row paste)
// ============================================================

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import {
  Save, Send, AlertTriangle, CheckCircle2, ChevronUp,
  ChevronDown, Info, Loader2, Lock, Search, Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { saveDraftScores } from "@/actions/results/saveScores";
import { submitResultsForApproval } from "@/actions/results/compileResults";
import ScoreUploader from "@/components/results/ScoreUploader";
import type { Term } from "@/types";

// ─── Types ────────────────────────────────────────────────────

export interface StudentRow {
  studentId: string;
  studentNo: string;
  name:      string;
  ca1:       string;
  ca2:       string;
  ca3:       string;
  examScore: string;
  isLocked:  boolean;
  isDirty:   boolean;
}

interface CellError {
  studentId: string;
  field:     ScoreField;
  message:   string;
}

type ScoreField = "ca1" | "ca2" | "ca3" | "examScore";

export interface ResultInputGridProps {
  classId:      string;
  subjectId:    string;
  sessionId:    string;
  term:         Term;
  className:    string;
  subjectName:  string;
  sessionName:  string;
  maxCA1?:      number;
  maxCA2?:      number;
  maxCA3?:      number;
  maxExam?:     number;
  initialRows?: {
    studentId: string;
    studentNo: string;
    name:      string;
    ca1?:      number | null;
    ca2?:      number | null;
    ca3?:      number | null;
    examScore?: number | null;
    isLocked?: boolean;
  }[];
}

const FIELDS: { key: ScoreField; label: string }[] = [
  { key: "ca1",       label: "CA 1"  },
  { key: "ca2",       label: "CA 2"  },
  { key: "ca3",       label: "CA 3"  },
  { key: "examScore", label: "Exam"  },
];

function toDisplay(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

function computeTotal(
  row: StudentRow,
  maxCA1: number, maxCA2: number, maxCA3: number, maxExam: number
): { value: number | null; display: string; isComplete: boolean } {
  const ca1  = row.ca1  === "" ? null : parseFloat(row.ca1);
  const ca2  = row.ca2  === "" ? null : parseFloat(row.ca2);
  const ca3  = row.ca3  === "" ? null : parseFloat(row.ca3);
  const exam = row.examScore === "" ? null : parseFloat(row.examScore);

  const hasAny = [ca1, ca2, ca3, exam].some((v) => v !== null);
  if (!hasAny) return { value: null, display: "—", isComplete: false };

  const total = (ca1 ?? 0) + (ca2 ?? 0) + (ca3 ?? 0) + (exam ?? 0);
  const max   = maxCA1 + maxCA2 + maxCA3 + maxExam;
  const isComplete = [ca1, ca2, ca3, exam].every((v) => v !== null);
  return { value: Math.min(total, max), display: isComplete ? String(total) : `${total}*`, isComplete };
}

function getGrade(total: number): { grade: string; color: string } {
  if (total >= 75) return { grade: "A",  color: "text-emerald-600" };
  if (total >= 65) return { grade: "B",  color: "text-blue-600"    };
  if (total >= 55) return { grade: "C",  color: "text-cyan-600"    };
  if (total >= 45) return { grade: "D",  color: "text-yellow-600"  };
  if (total >= 40) return { grade: "E",  color: "text-orange-600"  };
  return              { grade: "F",  color: "text-red-600"      };
}

// ─── Component ───────────────────────────────────────────────

export default function ResultInputGrid({
  classId, subjectId, sessionId, term,
  className, subjectName, sessionName,
  maxCA1 = 10, maxCA2 = 10, maxCA3 = 10, maxExam = 70,
  initialRows = [],
}: ResultInputGridProps) {

  const router = useRouter();
  const maxTotal = maxCA1 + maxCA2 + maxCA3 + maxExam;

  // ── State ────────────────────────────────────────────────────
  const [rows, setRows] = useState<StudentRow[]>(() =>
    initialRows.map((r) => ({
      studentId: r.studentId,
      studentNo: r.studentNo,
      name:      r.name,
      ca1:       toDisplay(r.ca1),
      ca2:       toDisplay(r.ca2),
      ca3:       toDisplay(r.ca3),
      examScore: toDisplay(r.examScore),
      isLocked:  r.isLocked ?? false,
      isDirty:   false,
    }))
  );

  const [errors, setErrors]         = useState<CellError[]>([]);
  const [search, setSearch]         = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [toast, setToast]           = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; field: ScoreField } | null>(null);
  const [showConfirm, setConfirm]   = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [sortField, setSortField]   = useState<"name" | ScoreField | "total">("name");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("asc");

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Unsaved changes warning ───────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ── Toast ────────────────────────────────────────────────────
  const showToast = useCallback((type: "success" | "error" | "warning", message: string) => {
    clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Cell key for ref map ──────────────────────────────────────
  const cellKey = (rowIdx: number, field: ScoreField) => `${rowIdx}:${field}`;

  // ── Validate a single cell ────────────────────────────────────
  const validateCell = useCallback((studentId: string, field: ScoreField, value: string): string | null => {
    if (value === "" || value === null) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return "Must be a number";
    if (num < 0)    return "Cannot be negative";
    const maxes: Record<ScoreField, number> = { ca1: maxCA1, ca2: maxCA2, ca3: maxCA3, examScore: maxExam };
    if (num > maxes[field]) return `Max is ${maxes[field]}`;
    if (!Number.isInteger(num * 2)) return "Use whole or half numbers"; // allow .5 steps
    return null;
  }, [maxCA1, maxCA2, maxCA3, maxExam]);

  // ── Handle cell change ────────────────────────────────────────
  const handleChange = useCallback((rowIdx: number, field: ScoreField, value: string) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== rowIdx || row.isLocked) return row;
      return { ...row, [field]: value, isDirty: true };
    }));
    setHasChanges(true);

    const studentId = rows[rowIdx]?.studentId;
    if (!studentId) return;

    const errMsg = validateCell(studentId, field, value);
    setErrors((prev) => {
      const rest = prev.filter((e) => !(e.studentId === studentId && e.field === field));
      return errMsg ? [...rest, { studentId, field, message: errMsg }] : rest;
    });
  }, [rows, validateCell]);

  // ── Keyboard navigation ───────────────────────────────────────
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    fieldIdx: number
  ) => {
    const fieldOrder = FIELDS.map((f) => f.key);
    const totalRows  = rows.length;
    const totalCols  = fieldOrder.length;

    let nextRow  = rowIdx;
    let nextCol  = fieldIdx;
    let handled  = false;

    switch (e.key) {
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (fieldIdx > 0) nextCol = fieldIdx - 1;
          else if (rowIdx > 0) { nextRow = rowIdx - 1; nextCol = totalCols - 1; }
        } else {
          if (fieldIdx < totalCols - 1) nextCol = fieldIdx + 1;
          else if (rowIdx < totalRows - 1) { nextRow = rowIdx + 1; nextCol = 0; }
        }
        handled = true;
        break;
      case "Enter":
        e.preventDefault();
        if (rowIdx < totalRows - 1) { nextRow = rowIdx + 1; }
        handled = true;
        break;
      case "ArrowUp":
        if (rowIdx > 0) { e.preventDefault(); nextRow = rowIdx - 1; handled = true; }
        break;
      case "ArrowDown":
        if (rowIdx < totalRows - 1) { e.preventDefault(); nextRow = rowIdx + 1; handled = true; }
        break;
      case "ArrowLeft":
        if (fieldIdx > 0 && (e.currentTarget.selectionStart === 0)) {
          e.preventDefault(); nextCol = fieldIdx - 1; handled = true;
        }
        break;
      case "ArrowRight":
        if (fieldIdx < totalCols - 1 && (e.currentTarget.selectionStart === e.currentTarget.value.length)) {
          e.preventDefault(); nextCol = fieldIdx + 1; handled = true;
        }
        break;
    }

    if (handled) {
      const key = cellKey(nextRow, fieldOrder[nextCol] as ScoreField);
      cellRefs.current.get(key)?.focus();
      setActiveCell({ rowIdx: nextRow, field: fieldOrder[nextCol] as ScoreField });
    }
  }, [rows]);

  // ── Paste handler (from Excel: tab-separated columns) ─────────
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, fieldIdx: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // not tabular, let default handle
    e.preventDefault();

    const pastedRows = text.trim().split("\n").map((line) => line.split("\t"));
    const fieldOrder = FIELDS.map((f) => f.key);

    setRows((prev) => {
      const next = [...prev];
      pastedRows.forEach((pastedCols, ri) => {
        const targetRow = rowIdx + ri;
        if (targetRow >= next.length) return;
        if (next[targetRow].isLocked) return;

        pastedCols.forEach((val, ci) => {
          const targetCol = fieldIdx + ci;
          if (targetCol >= fieldOrder.length) return;
          const field = fieldOrder[targetCol] as ScoreField;
          const clean = val.trim();
          next[targetRow] = { ...next[targetRow], [field]: clean, isDirty: true };
        });
      });
      return next;
    });
    setHasChanges(true);
  }, []);

  // ── Sort ──────────────────────────────────────────────────────
  const handleSort = (field: "name" | ScoreField | "total") => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filteredRows = rows
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.studentNo.includes(search))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * dir;
      if (sortField === "total") {
        const ta = computeTotal(a, maxCA1, maxCA2, maxCA3, maxExam).value ?? -1;
        const tb = computeTotal(b, maxCA1, maxCA2, maxCA3, maxExam).value ?? -1;
        return (ta - tb) * dir;
      }
      const fa = parseFloat(a[sortField]) || -1;
      const fb = parseFloat(b[sortField]) || -1;
      return (fa - fb) * dir;
    });

  // ── Error helpers ─────────────────────────────────────────────
  const getCellError = (studentId: string, field: ScoreField) =>
    errors.find((e) => e.studentId === studentId && e.field === field);

  const hasErrors = errors.length > 0;

  // ── Save Draft ────────────────────────────────────────────────
  const handleSaveDraft = () => {
    if (hasErrors) {
      showToast("error", `Fix ${errors.length} validation error(s) before saving.`);
      return;
    }

    startTransition(async () => {
      const scoreRows = rows.map((r) => ({
        studentId: r.studentId,
        ca1:       r.ca1  === "" ? null : parseFloat(r.ca1),
        ca2:       r.ca2  === "" ? null : parseFloat(r.ca2),
        ca3:       r.ca3  === "" ? null : parseFloat(r.ca3),
        examScore: r.examScore === "" ? null : parseFloat(r.examScore),
      }));

      const result = await saveDraftScores({
        classId, subjectId, sessionId, term,
        rows: scoreRows, maxCA1, maxCA2, maxCA3, maxExam,
      });

      if (result.success) {
        setRows((prev) => prev.map((r) => ({ ...r, isDirty: false })));
        setHasChanges(false);
        showToast("success", result.message);
      } else {
        showToast("error", result.message);
        if (result.errors.length > 0) {
          const newErrors: CellError[] = result.errors.flatMap((e) => [{
            studentId: e.studentId, field: "ca1" as ScoreField, message: e.message,
          }]);
          setErrors((prev) => [...prev, ...newErrors]);
        }
      }
    });
  };

  // ── Submit for Approval ───────────────────────────────────────
  const handleSubmit = async () => {
    setConfirm(false);
    setSubmitting(true);
    try {
      const result = await submitResultsForApproval({ classId, subjectId, sessionId, term });
      if (result.success) {
        showToast("success", result.message);
        setHasChanges(false);
      } else {
        showToast("error", result.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────
  const completedRows = rows.filter((r) =>
    computeTotal(r, maxCA1, maxCA2, maxCA3, maxExam).isComplete
  );
  const classAverage = completedRows.length > 0
    ? (completedRows.reduce((sum, r) => {
        return sum + (computeTotal(r, maxCA1, maxCA2, maxCA3, maxExam).value ?? 0);
      }, 0) / completedRows.length).toFixed(1)
    : "—";

  const highest = completedRows.length > 0
    ? Math.max(...completedRows.map((r) => computeTotal(r, maxCA1, maxCA2, maxCA3, maxExam).value ?? 0))
    : null;
  const lowest = completedRows.length > 0
    ? Math.min(...completedRows.map((r) => computeTotal(r, maxCA1, maxCA2, maxCA3, maxExam).value ?? 0))
    : null;

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-40" />
    );

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 font-sans">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>{sessionName}</span>
            <span>·</span>
            <span className="capitalize">{term.toLowerCase()} Term</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {subjectName} — {className}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted">
            <span>Max: CA1={maxCA1} · CA2={maxCA2} · CA3={maxCA3} · Exam={maxExam} · Total={maxTotal}</span>
            {hasChanges && (
              <span className="flex items-center gap-1 text-warn font-medium">
                <AlertTriangle className="w-3 h-3" /> Unsaved changes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUploader(true)}
            className="btn-secondary btn-sm gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk Upload
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isPending || !hasChanges || hasErrors}
            className="btn-secondary btn-sm gap-2"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </button>
          <button
            onClick={() => setConfirm(true)}
            disabled={submitting || hasErrors || hasChanges}
            className="btn-primary btn-sm gap-2"
            title={hasChanges ? "Save draft first" : "Submit to form teacher"}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit for Approval
          </button>
        </div>
      </div>

      {/* ── Summary stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Students",   value: rows.length },
          { label: "Completed",  value: `${completedRows.length} / ${rows.length}` },
          { label: "Class Avg",  value: classAverage },
          { label: "Errors",     value: errors.length, highlight: errors.length > 0 },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`card card-body py-3 ${highlight ? "border-red-200 bg-red-50" : ""}`}>
            <div className={`font-display text-xl font-bold ${highlight ? "text-danger" : "text-ink"}`}>{value}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Search + keyboard hint ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className="input pl-8 text-sm py-1.5"
          />
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted">
          <Info className="w-3.5 h-3.5" />
          Tab / Arrow keys to navigate · Paste from Excel supported
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {/* Head */}
            <thead>
              <tr className="bg-brand-950 text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold w-8 sticky left-0 bg-brand-950 z-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold min-w-[80px]">Reg. No.</th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold min-w-[180px] cursor-pointer group select-none"
                  onClick={() => handleSort("name")}
                >
                  <span className="flex items-center gap-1">Student Name <SortIcon field="name" /></span>
                </th>
                {FIELDS.map((f) => (
                  <th
                    key={f.key}
                    className="px-3 py-3 text-center text-xs font-semibold w-24 cursor-pointer group select-none"
                    onClick={() => handleSort(f.key)}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {f.label}
                      <span className="text-brand-300 font-normal">
                        /{f.key === "ca1" ? maxCA1 : f.key === "ca2" ? maxCA2 : f.key === "ca3" ? maxCA3 : maxExam}
                      </span>
                      <SortIcon field={f.key} />
                    </span>
                  </th>
                ))}
                <th
                  className="px-3 py-3 text-center text-xs font-semibold w-24 cursor-pointer group select-none"
                  onClick={() => handleSort("total")}
                >
                  <span className="flex items-center justify-center gap-1">
                    Total/{maxTotal} <SortIcon field="total" />
                  </span>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold w-16">Grade</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={FIELDS.length + 5} className="px-4 py-8 text-center text-muted text-sm">
                    No students found.
                  </td>
                </tr>
              )}
              {filteredRows.map((row, displayIdx) => {
                // Find actual index in original rows array for state updates
                const rowIdx = rows.findIndex((r) => r.studentId === row.studentId);
                const { value: totalValue, display: totalDisplay } = computeTotal(row, maxCA1, maxCA2, maxCA3, maxExam);
                const gradeInfo = totalValue !== null ? getGrade(totalValue) : null;
                const rowHasError = errors.some((e) => e.studentId === row.studentId);

                return (
                  <tr
                    key={row.studentId}
                    className={[
                      "border-b border-border transition-colors",
                      row.isLocked   ? "bg-slate-50 opacity-70" : "",
                      row.isDirty    ? "bg-amber-50/40" : "",
                      rowHasError    ? "bg-red-50/50" : "",
                      displayIdx % 2 === 0 && !row.isDirty && !rowHasError ? "bg-white" : "bg-slate-50/30",
                    ].join(" ")}
                  >
                    {/* Row # */}
                    <td className="px-4 py-2 text-xs text-muted text-center sticky left-0 bg-inherit">
                      {displayIdx + 1}
                    </td>

                    {/* Reg No. */}
                    <td className="px-4 py-2 font-mono text-xs text-muted">{row.studentNo}</td>

                    {/* Name */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {row.isLocked && <Lock className="w-3 h-3 text-muted shrink-0" />}
                        <span className={`font-medium ${row.isLocked ? "text-muted" : "text-ink"}`}>{row.name}</span>
                        {row.isDirty && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved" />
                        )}
                      </div>
                    </td>

                    {/* Score cells */}
                    {FIELDS.map((f, fieldIdx) => {
                      const error = getCellError(row.studentId, f.key);
                      const isActive = activeCell?.rowIdx === rowIdx && activeCell?.field === f.key;

                      return (
                        <td key={f.key} className="px-1.5 py-1.5 text-center">
                          <div className="relative group">
                            <input
                              ref={(el) => {
                                if (el) cellRefs.current.set(cellKey(rowIdx, f.key), el);
                                else cellRefs.current.delete(cellKey(rowIdx, f.key));
                              }}
                              type="number"
                              min={0}
                              max={f.key === "ca1" ? maxCA1 : f.key === "ca2" ? maxCA2 : f.key === "ca3" ? maxCA3 : maxExam}
                              step={0.5}
                              value={row[f.key]}
                              disabled={row.isLocked}
                              onChange={(e) => handleChange(rowIdx, f.key, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIdx, fieldIdx)}
                              onPaste={(e) => handlePaste(e, rowIdx, fieldIdx)}
                              onFocus={() => setActiveCell({ rowIdx, field: f.key })}
                              onBlur={() => {
                                // Validate on blur
                                const err = validateCell(row.studentId, f.key, row[f.key]);
                                if (err) {
                                  setErrors((prev) => {
                                    const rest = prev.filter((e) => !(e.studentId === row.studentId && e.field === f.key));
                                    return [...rest, { studentId: row.studentId, field: f.key, message: err }];
                                  });
                                }
                              }}
                              className={[
                                "w-20 text-center rounded-lg border px-2 py-1.5 text-sm font-mono transition-all outline-none",
                                "disabled:bg-transparent disabled:border-transparent disabled:cursor-not-allowed disabled:text-muted",
                                error
                                  ? "border-red-400 bg-red-50 text-red-700 ring-1 ring-red-300 focus:ring-red-400"
                                  : isActive
                                  ? "border-brand-500 ring-2 ring-brand-200 bg-white"
                                  : "border-border bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
                              ].join(" ")}
                            />
                            {/* Error tooltip */}
                            {error && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover:block">
                                <div className="bg-red-700 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                  {error.message}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-700" />
                                </div>
                              </div>
                            )}
                            {error && (
                              <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-red-500 pointer-events-none" />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td className={`px-3 py-2 text-center font-mono font-bold text-sm ${
                      totalValue === null ? "text-muted" :
                      totalValue >= 75 ? "text-emerald-600" :
                      totalValue >= 40 ? "text-ink" : "text-red-600"
                    }`}>
                      {totalDisplay}
                    </td>

                    {/* Grade */}
                    <td className="px-3 py-2 text-center">
                      {gradeInfo && totalValue !== null && (
                        <span className={`font-bold text-sm ${gradeInfo.color}`}>
                          {gradeInfo.grade}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer stats */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-border">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-muted">
                    CLASS SUMMARY — {completedRows.length} / {rows.length} complete
                  </td>
                  {FIELDS.map((f) => {
                    const vals = filteredRows
                      .map((r) => parseFloat(r[f.key]))
                      .filter((v) => !isNaN(v));
                    const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
                    return (
                      <td key={f.key} className="px-3 py-2.5 text-center">
                        <div className="text-xs font-semibold text-ink">{avg}</div>
                        <div className="text-xs text-muted">avg</div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <div className="text-xs font-bold text-ink">{classAverage}</div>
                    <div className="text-xs text-muted">avg</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {highest !== null && lowest !== null && (
                      <div className="text-xs text-muted">
                        <span className="text-emerald-600">{highest}</span> / <span className="text-red-500">{lowest}</span>
                      </div>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Error summary ──────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="card border-red-200 bg-red-50 card-body py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">{errors.length} validation error{errors.length !== 1 ? "s" : ""}</p>
              <ul className="space-y-0.5">
                {errors.slice(0, 5).map((e, i) => {
                  const student = rows.find((r) => r.studentId === e.studentId);
                  return (
                    <li key={i} className="text-xs text-red-600">
                      <span className="font-medium">{student?.name}</span> — {e.field.toUpperCase()}: {e.message}
                    </li>
                  );
                })}
                {errors.length > 5 && (
                  <li className="text-xs text-red-500">…and {errors.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ─────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 z-50 card card-body flex items-center gap-3 border-2 py-3 shadow-xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm ${
          toast.type === "success" ? "border-green-200 bg-green-50" :
          toast.type === "error"   ? "border-red-200 bg-red-50" :
          "border-yellow-200 bg-yellow-50"
        }`}>
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
          {toast.type === "error"   && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
          {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />}
          <p className={`text-sm font-medium ${
            toast.type === "success" ? "text-green-800" :
            toast.type === "error"   ? "text-red-800" : "text-yellow-800"
          }`}>
            {toast.message}
          </p>
        </div>
      )}

      {/* ── Confirm Submit Modal ───────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-ink">Submit for Approval?</h2>
                <p className="text-muted text-sm mt-1">
                  You are submitting scores for <strong>{completedRows.length} student{completedRows.length !== 1 ? "s" : ""}</strong> in <strong>{subjectName}</strong>, {className}.
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 space-y-1">
              <p className="font-semibold">⚠ Before you submit:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>All scores will be sent to the Form Teacher for review.</li>
                <li>You will not be able to edit once submitted.</li>
                <li>Ensure all students have been scored.</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSubmit} className="btn-primary flex-1 justify-center">
                Yes, Submit
              </button>
              <button onClick={() => setConfirm(false)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">Upload Bulk Results</h2>
                <p className="mt-1 text-sm text-muted">Import Excel, Word, PDF, CSV, or TSV results.</p>
              </div>
              <button onClick={() => setShowUploader(false)} className="btn-ghost px-3 py-1.5 text-sm" aria-label="Close upload">
                Close
              </button>
            </div>
            <ScoreUploader
              classId={classId}
              subjectId={subjectId}
              sessionId={sessionId}
              term={term}
              subjectName={subjectName}
              className={className}
              maxCA1={maxCA1}
              maxCA2={maxCA2}
              maxCA3={maxCA3}
              maxExam={maxExam}
              onSuccess={() => {
                setShowUploader(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
