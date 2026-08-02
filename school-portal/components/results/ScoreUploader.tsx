"use client";
import { useState, useRef, useTransition } from "react";
import { Upload, Download, FileText, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { cn, Toast } from "@/components/ui";
import { uploadScores, parseScoreUpload } from "@/actions/results/uploadScores";
import type { Term } from "@/types";

interface Props {
  classId:   string;
  subjectId: string;
  sessionId: string;
  term:      Term;
  subjectName: string;
  className:   string;
  maxCA1?:   number;
  maxCA2?:   number;
  maxCA3?:   number;
  maxExam?:  number;
  onSuccess?: (imported: number) => void;
}

export default function ScoreUploader({ classId, subjectId, sessionId, term, subjectName, className, maxCA1=10, maxCA2=10, maxCA3=10, maxExam=70, onSuccess }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview,  setPreview]  = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [rawRows,  setRawRows]  = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [toast,    setToast]    = useState<any>(null);
  const [isPending, start]      = useTransition();

  const processFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "docx", "pdf", "csv", "tsv", "txt"].includes(ext ?? "")) {
      setToast({ type:"error", message:"Supported formats are Excel, Word, PDF, CSV, and TSV." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast({ type:"error", message:"Files must be 10 MB or smaller." });
      return;
    }

    start(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await parseScoreUpload(formData);
      setParseErrors(result.errors);
      setRawRows(result.rows);
      setPreview(result.preview.headers.length > 0 ? result.preview : null);
      setToast({ type: result.success ? "success" : "error", message: result.message });
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleUpload = () => {
    if (rawRows.length === 0) return;
    start(async () => {
      const result = await uploadScores({ classId, subjectId, sessionId, term, rows: rawRows, maxCA1, maxCA2, maxCA3, maxExam });
      if (result.success) {
        setToast({ type:"success", message: result.message });
        setPreview(null); setRawRows([]);
        onSuccess?.(result.imported);
      } else {
        setToast({ type: result.imported > 0 ? "warning" : "error", message: result.message });
      }
    });
  };

  const downloadTemplate = () => {
    const maxTotal = maxCA1 + maxCA2 + maxCA3 + maxExam;
    const header   = `StudentID,CA1 (max ${maxCA1}),CA2 (max ${maxCA2}),CA3 (max ${maxCA3}),Exam (max ${maxExam})`;
    const example  = `STU/2024/001,8,7,9,62\nSTU/2024/002,10,8,10,65\nSTU/2024/003,6,5,7,45`;
    const blob = new Blob([`${header}\n${example}`], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download=`scores_template_${subjectName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-ink">Bulk Score Upload</h2>
          <p className="text-xs text-muted mt-0.5">{subjectName} · {className}</p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary btn-sm gap-2">
          <Download className="w-3.5 h-3.5"/> CSV Template
        </button>
      </div>

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
            dragging ? "border-brand-500 bg-brand-50" : "border-border hover:border-brand-300 hover:bg-slate-50"
          )}>
          <Upload className={cn("w-10 h-10 mx-auto mb-3", dragging ? "text-brand-500" : "text-slate-300")}/>
          <p className="font-medium text-ink text-sm">Drop a result file here</p>
          <p className="text-xs text-muted mt-1">or click to browse</p>
          <p className="text-xs text-muted mt-2">Excel, Word, PDF, CSV, or TSV · Max 10 MB</p>
          {isPending && <Loader2 className="mx-auto mt-3 h-5 w-5 animate-spin text-brand-600" />}
          <input ref={fileRef} type="file" accept=".xlsx,.docx,.pdf,.csv,.tsv,.txt" onChange={handleFileChange} className="hidden"/>
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="card border-red-200 bg-red-50 card-body">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-red-700">Parse errors in file:</p>
              <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                {parseErrors.map((e,i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600"/>
              <span className="text-sm font-medium text-ink">{rawRows.length} rows detected</span>
              {rawRows.length > 0 && <span className="badge-green">Ready to import</span>}
            </div>
            <button onClick={() => { setPreview(null); setRawRows([]); setParseErrors([]); }} className="btn-ghost btn-icon btn-sm">
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-border">
              <p className="text-xs text-muted">Preview (first 5 rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table text-xs">
                <thead>
                  <tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>{row.map((c, j) => <td key={j}>{c || <span className="text-slate-300">—</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rawRows.length > 5 && (
              <div className="px-4 py-2 text-xs text-muted border-t border-border">
                …and {rawRows.length - 5} more rows
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={isPending || rawRows.length === 0} className="btn-primary gap-2">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin"/>Importing…</> : <><CheckCircle2 className="w-4 h-4"/>Import {rawRows.length} Scores</>}
            </button>
            <button onClick={() => { setPreview(null); setRawRows([]); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Format guide */}
      <div className="bg-slate-50 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold text-ink mb-2">Expected table format in every file type:</p>
        <pre className="text-xs font-mono text-muted overflow-x-auto">{`StudentID,CA1,CA2,CA3,Exam
STU/2024/001,8,7,9,62
STU/2024/002,10,8,10,65`}</pre>
        <p className="text-xs text-muted mt-2">
          · Use the student registration number (e.g. STU/2024/001)<br/>
          · Leave cells blank to skip that component<br/>
          · Word files should contain a table; PDFs must contain selectable text<br/>
          · Locked results will be skipped automatically
        </p>
      </div>
    </div>
  );
}
