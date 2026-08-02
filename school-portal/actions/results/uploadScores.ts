// actions/results/uploadScores.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Term } from "@/types";
import { assertClassAccess } from "@/lib/roles";
import readXlsxFile from "read-excel-file/node";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { hasExactSubjectAssignment } from "@/lib/authorization";

export interface UploadRow {
  studentId:  string; // student registration number e.g. STU/2024/001
  ca1?:       number | null;
  ca2?:       number | null;
  ca3?:       number | null;
  examScore?: number | null;
}

export interface UploadScoresInput {
  classId:   string;
  subjectId: string;
  sessionId: string;
  term:      Term;
  rows:      UploadRow[];
  maxCA1?:   number;
  maxCA2?:   number;
  maxCA3?:   number;
  maxExam?:  number;
}

export interface UploadScoresResult {
  success:  boolean;
  message:  string;
  imported: number;
  skipped:  number;
  errors:   { row: number; studentId: string; reason: string }[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function splitTextTable(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
      if (line.includes("|")) return line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (line.includes(",")) return line.split(",").map((cell) => cell.trim());
      return line.split(/\s{2,}/).map((cell) => cell.trim());
    });
}

function parseMatrix(matrix: string[][]): {
  rows: UploadRow[];
  errors: string[];
  preview: { headers: string[]; rows: string[][] };
} {
  const errors: string[] = [];
  const clean = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (clean.length < 2) {
    return { rows: [], errors: ["The file has no result rows."], preview: { headers: [], rows: [] } };
  }

  const headers = clean[0].map((header) => header.trim());
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const columns = {
    studentId: normalized.findIndex((header) => header.includes("studentid") || header.includes("studentno") || header.includes("regno") || header.includes("admissionno")),
    ca1: normalized.findIndex((header) => header === "ca1" || header.startsWith("ca1max")),
    ca2: normalized.findIndex((header) => header === "ca2" || header.startsWith("ca2max")),
    ca3: normalized.findIndex((header) => header === "ca3" || header.startsWith("ca3max")),
    examScore: normalized.findIndex((header) => header.includes("exam")),
  };
  if (columns.studentId === -1) {
    return {
      rows: [],
      errors: ["A Student ID, Registration Number, or Admission Number column is required."],
      preview: { headers, rows: clean.slice(1, 6) },
    };
  }

  const numberAt = (row: string[], index: number): number | null => {
    if (index < 0 || !row[index]?.trim()) return null;
    const value = Number(row[index].replace(/%/g, "").trim());
    return Number.isFinite(value) ? value : null;
  };
  const rows: UploadRow[] = [];
  clean.slice(1).forEach((row, index) => {
    const studentId = row[columns.studentId]?.trim();
    if (!studentId) {
      errors.push(`Row ${index + 2}: missing student ID.`);
      return;
    }
    rows.push({
      studentId,
      ca1: numberAt(row, columns.ca1),
      ca2: numberAt(row, columns.ca2),
      ca3: numberAt(row, columns.ca3),
      examScore: numberAt(row, columns.examScore),
    });
  });
  return { rows, errors, preview: { headers, rows: clean.slice(1, 6) } };
}

export async function parseScoreUpload(formData: FormData) {
  await requireSession(["SUBJECT_TEACHER", "FORM_TEACHER"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Select a result file.", rows: [], errors: [], preview: { headers: [], rows: [] } };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, message: "Files must be 10 MB or smaller.", rows: [], errors: [], preview: { headers: [], rows: [] } };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let matrix: string[][] = [];

  try {
    if (extension === "xlsx") {
      const rows = await readXlsxFile(buffer);
      matrix = rows.map((row) => row.map((cell) => cell == null ? "" : String(cell).trim()));
    } else if (extension === "docx") {
      const html = await mammoth.convertToHtml({ buffer });
      matrix = [...html.value.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
        [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => decodeHtml(cellMatch[1]))
      );
      if (matrix.length < 2) {
        const raw = await mammoth.extractRawText({ buffer });
        matrix = splitTextTable(raw.value);
      }
    } else if (extension === "pdf") {
      const parsed = await pdfParse(buffer);
      matrix = splitTextTable(parsed.text);
    } else if (["csv", "tsv", "txt"].includes(extension ?? "")) {
      matrix = splitTextTable(buffer.toString("utf8"));
    } else {
      return { success: false, message: "Supported formats are Excel, Word, PDF, CSV, and TSV.", rows: [], errors: [], preview: { headers: [], rows: [] } };
    }

    const parsed = parseMatrix(matrix);
    return {
      success: parsed.rows.length > 0,
      message: parsed.rows.length > 0 ? `${parsed.rows.length} result rows detected.` : "No valid result rows were detected.",
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "The result file could not be read.",
      rows: [],
      errors: [],
      preview: { headers: [], rows: [] },
    };
  }
}

export async function uploadScores(input: UploadScoresInput): Promise<UploadScoresResult> {
  const session = await requireSession(["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"]);
  const { classId, subjectId, sessionId, term, rows } = input;
  await assertClassAccess(session.user.role, classId);
  const maxCA1  = input.maxCA1  ?? 10;
  const maxCA2  = input.maxCA2  ?? 10;
  const maxCA3  = input.maxCA3  ?? 10;
  const maxExam = input.maxExam ?? 70;
  const maxTotal = maxCA1 + maxCA2 + maxCA3 + maxExam;

  // Authorization check
  if (session.user.role === "SUBJECT_TEACHER") {
    const ok = await hasExactSubjectAssignment(session.user.id, classId, subjectId);
    if (!ok) return { success: false, message: "Access denied.", imported: 0, skipped: 0, errors: [] };
  }
  if (session.user.role === "FORM_TEACHER" && session.user.formClassId !== classId) {
    return { success: false, message: "You can only upload results for your form class.", imported: 0, skipped: 0, errors: [] };
  }

  if (rows.length === 0)
    return { success: false, message: "No rows to import.", imported: 0, skipped: 0, errors: [] };

  // Resolve student registration numbers → IDs
  const regNos   = rows.map(r => r.studentId.trim());
  const students = await prisma.student.findMany({
    where: { studentId: { in: regNos }, classId, isActive: true },
    select: { id: true, studentId: true },
  });
  const studentMap = new Map(students.map(s => [s.studentId, s.id]));

  const errors: UploadScoresResult["errors"] = [];
  const validUpserts: { studentId:string; ca1:number|null; ca2:number|null; ca3:number|null; examScore:number|null; total:number }[] = [];

  rows.forEach((row, idx) => {
    const dbId = studentMap.get(row.studentId.trim());
    if (!dbId) {
      errors.push({ row: idx + 2, studentId: row.studentId, reason: "Student not found in this class" });
      return;
    }

    const ca1  = row.ca1  ?? null;
    const ca2  = row.ca2  ?? null;
    const ca3  = row.ca3  ?? null;
    const exam = row.examScore ?? null;

    // Validate ranges
    if (ca1 !== null && (ca1 < 0 || ca1 > maxCA1))  { errors.push({ row:idx+2, studentId:row.studentId, reason:`CA1 out of range (0–${maxCA1})` }); return; }
    if (ca2 !== null && (ca2 < 0 || ca2 > maxCA2))  { errors.push({ row:idx+2, studentId:row.studentId, reason:`CA2 out of range (0–${maxCA2})` }); return; }
    if (ca3 !== null && (ca3 < 0 || ca3 > maxCA3))  { errors.push({ row:idx+2, studentId:row.studentId, reason:`CA3 out of range (0–${maxCA3})` }); return; }
    if (exam !== null && (exam < 0 || exam > maxExam)){ errors.push({ row:idx+2, studentId:row.studentId, reason:`Exam out of range (0–${maxExam})` }); return; }

    const total = Math.min((ca1??0)+(ca2??0)+(ca3??0)+(exam??0), maxTotal);
    validUpserts.push({ studentId: dbId, ca1, ca2, ca3, examScore: exam, total });
  });

  if (validUpserts.length === 0) {
    return { success: false, message: "All rows had errors. Nothing imported.", imported: 0, skipped: rows.length, errors };
  }

  // Batch upsert
  await prisma.$transaction(async (tx) => {
    for (const u of validUpserts) {
      const existing = await tx.result.findFirst({
        where: { studentId: u.studentId, subjectId, sessionId, term },
        select: { status: true },
      });
      if (existing?.status === "LOCKED") {
        errors.push({ row: 0, studentId: u.studentId, reason: "Result is locked" });
        continue;
      }

      await tx.result.upsert({
        where: { studentId_subjectId_sessionId_term: { studentId: u.studentId, subjectId, sessionId, term } },
        update: { ca1: u.ca1, ca2: u.ca2, ca3: u.ca3, examScore: u.examScore, total: u.total, status: "DRAFT", maxCA1, maxCA2, maxCA3, maxExam, maxTotal },
        create: { studentId: u.studentId, classId, subjectId, sessionId, term, ca1: u.ca1, ca2: u.ca2, ca3: u.ca3, examScore: u.examScore, total: u.total, status: "DRAFT", maxCA1, maxCA2, maxCA3, maxExam, maxTotal },
      });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "UPLOAD",
      entity: "Result",
      entityId: `${classId}:${subjectId}`,
      description: `Bulk score upload: ${validUpserts.length} rows — ${term} term`,
      newValue: { classId, subjectId, sessionId, term, count: validUpserts.length },
    });
  });

  revalidatePath(`/teacher/results/${classId}/${subjectId}`);
  revalidatePath(`/admin/results`);

  const imported = validUpserts.length - errors.filter(e => e.row === 0).length;
  return {
    success:  errors.length === 0,
    message:  `${imported} scores imported${errors.length > 0 ? `, ${errors.length} error(s)` : "."}.`,
    imported,
    skipped:  rows.length - imported,
    errors,
  };
}

/**
 * Parse a raw CSV/TSV string into UploadRow[]
 * Expected header: StudentID, CA1, CA2, CA3, Exam
 */
function parseCSV(text: string): { rows: UploadRow[]; errors: string[] } {
  const lines  = text.trim().split(/\r?\n/);
  const errors: string[] = [];
  const rows:   UploadRow[] = [];

  if (lines.length < 2) return { rows: [], errors: ["File has no data rows."] };

  // Detect delimiter
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase());

  const colIdx = {
    studentId:  headers.findIndex(h => h.includes("student") || h.includes("reg") || h.includes("id")),
    ca1:        headers.findIndex(h => h === "ca1" || h === "ca 1"),
    ca2:        headers.findIndex(h => h === "ca2" || h === "ca 2"),
    ca3:        headers.findIndex(h => h === "ca3" || h === "ca 3"),
    examScore:  headers.findIndex(h => h.includes("exam")),
  };

  if (colIdx.studentId === -1) return { rows: [], errors: ["Column 'StudentID' or 'Reg No' not found in header."] };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim());
    if (cols.every(c => !c)) continue; // skip empty rows

    const sId = cols[colIdx.studentId];
    if (!sId) { errors.push(`Row ${i+1}: Missing student ID`); continue; }

    const parseNum = (idx: number): number | null => {
      if (idx === -1 || !cols[idx]) return null;
      const n = parseFloat(cols[idx]);
      return isNaN(n) ? null : n;
    };

    rows.push({
      studentId:  sId,
      ca1:       parseNum(colIdx.ca1),
      ca2:       parseNum(colIdx.ca2),
      ca3:       parseNum(colIdx.ca3),
      examScore: parseNum(colIdx.examScore),
    });
  }

  return { rows, errors };
}
