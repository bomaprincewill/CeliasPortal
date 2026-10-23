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
import { validateScoreConfiguration } from "@/lib/settingsValidation";

export interface UploadRow {
  studentId:  string; // student registration number e.g. STU/2024/001
  ca1?:       number | null;
  ca2?:       number | null;
  ca3?:       number | null;
  examScore?: number | null;
}

export interface BroadSheetUploadRow {
  studentId: string;
  scores: { subjectName: string; ca1: number | null; ca2: number | null; ca3: number | null; examScore: number | null }[];
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

function scoreNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const number = Number(value.replace(/,/g, "").replace(/%$/, "").trim());
  return Number.isFinite(number) ? number : null;
}

function parseBroadSheet(matrix: string[][]): { rows: BroadSheetUploadRow[]; errors: string[]; preview: { headers: string[]; rows: string[][] } } | null {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => /^s\/?n$/i.test(cell.trim())) && row.some((cell) => /^name$/i.test(cell.trim())));
  if (headerIndex < 0 || !matrix[headerIndex + 1]) return null;

  const headings = matrix[headerIndex];
  const components = matrix[headerIndex + 1];
  const serialColumn = headings.findIndex((cell) => /^s\/?n$/i.test(cell.trim()));
  const nameColumn = headings.findIndex((cell) => /^name$/i.test(cell.trim()));
  const subjects = new Map<string, { name: string; columns: Partial<Record<"ca1" | "ca2" | "ca3" | "examScore", number>> }>();
  let currentSubject = "";
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (let column = 0; column < Math.max(headings.length, components.length); column++) {
    const heading = headings[column]?.trim() ?? "";
    if (heading) currentSubject = ["sn", "name", "total", "average", "position", "actions"].includes(normalized(heading)) ? "" : heading;
    const component = normalized(components[column]?.trim() ?? "");
    const key = component === "ca1" ? "ca1" : component === "ca2" ? "ca2" : component === "ca3" ? "ca3" : component.includes("exam") ? "examScore" : null;
    if (!currentSubject || !key) continue;
    const subject = subjects.get(currentSubject) ?? { name: currentSubject, columns: {} };
    subject.columns[key] = column;
    subjects.set(currentSubject, subject);
  }
  if (subjects.size === 0) return null;

  const rows: BroadSheetUploadRow[] = [];
  const errors: string[] = [];
  for (let index = headerIndex + 2; index < matrix.length; index++) {
    if (scoreNumber(matrix[index][serialColumn]) === null) continue;
    const studentId = [matrix[index + 1]?.[nameColumn], matrix[index]?.[nameColumn]]
      .map((value) => value?.trim() ?? "")
      .find((value) => /^CIS\d{4}\/\d+$/i.test(value));
    if (!studentId) {
      errors.push(`Row ${index + 1}: no CIS student ID found below the student name.`);
      continue;
    }
    rows.push({
      studentId: studentId.toUpperCase(),
      scores: [...subjects.values()].map((subject) => ({
        subjectName: subject.name,
        ca1: scoreNumber(matrix[index][subject.columns.ca1 ?? -1]),
        ca2: scoreNumber(matrix[index][subject.columns.ca2 ?? -1]),
        ca3: scoreNumber(matrix[index][subject.columns.ca3 ?? -1]),
        examScore: scoreNumber(matrix[index][subject.columns.examScore ?? -1]),
      })),
    });
  }
  return { rows, errors, preview: { headers: ["Student ID", ...[...subjects.keys()]], rows: rows.slice(0, 5).map((row) => [row.studentId, ...row.scores.map((score) => String((score.ca1 ?? 0) + (score.ca2 ?? 0) + (score.ca3 ?? 0) + (score.examScore ?? 0)))]) } };
}

export async function parseScoreUpload(formData: FormData) {
  await requireSession(["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"]);
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

    const broadSheet = extension === "xlsx" ? parseBroadSheet(matrix) : null;
    if (broadSheet) {
      return {
        success: broadSheet.rows.length > 0,
        format: "broad-sheet" as const,
        message: `${broadSheet.rows.length} students and ${broadSheet.rows[0]?.scores.length ?? 0} subjects detected from the broadsheet.`,
        rows: [],
        broadSheetRows: broadSheet.rows,
        errors: broadSheet.errors,
        preview: broadSheet.preview,
      };
    }
    const parsed = parseMatrix(matrix);
    return {
      success: parsed.rows.length > 0,
      format: "single-subject" as const,
      message: parsed.rows.length > 0 ? `${parsed.rows.length} result rows detected.` : "No valid result rows were detected.",
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "The result file could not be read.",
      rows: [], broadSheetRows: [], format: "single-subject" as const,
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
  const configurationError = validateScoreConfiguration({ maxCA1, maxCA2, maxCA3, maxExam });
  if (configurationError) return { success: false, message: configurationError, imported: 0, skipped: rows.length, errors: [] };

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
  const classSession = await prisma.class.findFirst({ where: { id: classId, sessionId }, select: { id: true } });
  if (!classSession) return { success: false, message: "Class does not belong to the selected academic session.", imported: 0, skipped: rows.length, errors: [] };

  // Resolve student registration numbers → IDs
  const regNos   = rows.map(r => r.studentId.trim());
  const students = await prisma.student.findMany({
    where: { studentId: { in: regNos }, enrollments: { some: { classId, sessionId } } },
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
    if ([ca1, ca2, ca3, exam].some(value => value !== null && !Number.isFinite(value))) {
      errors.push({ row: idx + 2, studentId: row.studentId, reason: "Scores must be finite numbers." }); return;
    }

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
      const lockedSheet = await tx.broadSheet.findFirst({ where: { studentId: u.studentId, classId, sessionId, term, isLocked: true }, select: { id: true } });
      if (existing?.status === "LOCKED" || lockedSheet) {
        errors.push({ row: 0, studentId: u.studentId, reason: "Result is locked" });
        continue;
      }

      await tx.result.upsert({
        where: { studentId_subjectId_sessionId_term: { studentId: u.studentId, subjectId, sessionId, term } },
        update: { ca1: u.ca1, ca2: u.ca2, ca3: u.ca3, examScore: u.examScore, total: u.total, status: "DRAFT", grade: null, gradePoint: null, remark: null, position: null, submittedAt: null, approvedAt: null, maxCA1, maxCA2, maxCA3, maxExam, maxTotal },
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
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 60_000 });

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

export async function uploadBroadSheetScores(input: { classId: string; sessionId: string; term: Term; rows: BroadSheetUploadRow[] }): Promise<UploadScoresResult> {
  const session = await requireSession(["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"]);
  await assertClassAccess(session.user.role, input.classId);
  if (!input.rows.length) return { success: false, message: "No broadsheet rows to import.", imported: 0, skipped: 0, errors: [] };

  const schoolClass = await prisma.class.findUnique({ where: { id: input.classId }, select: { level: true, sessionId: true } });
  if (!schoolClass || schoolClass.sessionId !== input.sessionId) return { success: false, message: "Class does not belong to the selected academic session.", imported: 0, skipped: input.rows.length, errors: [] };
  const limits = schoolClass.level.toLowerCase() === "secondary"
    ? { maxCA1: 20, maxCA2: 20, maxCA3: 20, maxExam: 40 }
    : { maxCA1: 20, maxCA2: 20, maxCA3: 0, maxExam: 60 };
  const maxTotal = limits.maxCA1 + limits.maxCA2 + limits.maxCA3 + limits.maxExam;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^culturalandcreativeart$/, "culturalandcreativearts");
  const [students, subjects] = await Promise.all([
    prisma.student.findMany({ where: { enrollments: { some: { classId: input.classId, sessionId: input.sessionId } } }, select: { id: true, studentId: true } }),
    prisma.subject.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);
  const studentIds = new Map(students.map((student) => [student.studentId.toUpperCase(), student.id]));
  const subjectIds = new Map(subjects.map((subject) => [normalize(subject.name), subject.id]));
  const errors: UploadScoresResult["errors"] = [];
  let imported = 0;

  for (const [rowIndex, row] of input.rows.entries()) {
    const studentId = studentIds.get(row.studentId.toUpperCase());
    if (!studentId) { errors.push({ row: rowIndex + 1, studentId: row.studentId, reason: "Student not found in this class" }); continue; }
    for (const score of row.scores) {
      const subjectId = subjectIds.get(normalize(score.subjectName));
      if (!subjectId) { errors.push({ row: rowIndex + 1, studentId: row.studentId, reason: `Subject not found: ${score.subjectName}` }); continue; }
      const values = [score.ca1, score.ca2, score.ca3, score.examScore];
      if (values.some((value) => value !== null && (!Number.isFinite(value) || value < 0)) || (score.ca1 ?? 0) > limits.maxCA1 || (score.ca2 ?? 0) > limits.maxCA2 || (score.ca3 ?? 0) > limits.maxCA3 || (score.examScore ?? 0) > limits.maxExam) {
        errors.push({ row: rowIndex + 1, studentId: row.studentId, reason: `Score exceeds the class maximum for ${score.subjectName}` }); continue;
      }
      const total = Math.min((score.ca1 ?? 0) + (score.ca2 ?? 0) + (score.ca3 ?? 0) + (score.examScore ?? 0), maxTotal);
      const saved = await prisma.$transaction(async tx => {
      const existing = await tx.result.findUnique({ where: { studentId_subjectId_sessionId_term: { studentId, subjectId, sessionId: input.sessionId, term: input.term } }, select: { status: true } });
      const lockedSheet = await tx.broadSheet.findFirst({ where: { studentId, classId: input.classId, sessionId: input.sessionId, term: input.term, isLocked: true }, select: { id: true } });
      if (existing?.status === "LOCKED" || lockedSheet) return false;
      await tx.result.upsert({
        where: { studentId_subjectId_sessionId_term: { studentId, subjectId, sessionId: input.sessionId, term: input.term } },
        update: { classId: input.classId, ca1: score.ca1, ca2: score.ca2, ca3: score.ca3, examScore: score.examScore, total, ...limits, maxTotal, status: "DRAFT", grade: null, gradePoint: null, remark: null, position: null, submittedAt: null, approvedAt: null },
        create: { studentId, subjectId, classId: input.classId, sessionId: input.sessionId, term: input.term, ca1: score.ca1, ca2: score.ca2, ca3: score.ca3, examScore: score.examScore, total, ...limits, maxTotal, status: "DRAFT" },
      });
      return true;
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
      if (!saved) { errors.push({ row: rowIndex + 1, studentId: row.studentId, reason: `Locked result: ${score.subjectName}` }); continue; }
      imported += 1;
    }
  }
  await writeAuditLog({ userId: session.user.id, action: "UPLOAD", entity: "Result", entityId: input.classId, description: `Broadsheet upload: ${imported} subject scores — ${input.term} term`, newValue: { classId: input.classId, sessionId: input.sessionId, term: input.term, imported } });
  revalidatePath(`/admin/results`);
  revalidatePath(`/teacher/results`);
  return { success: errors.length === 0, message: `${imported} subject scores imported${errors.length ? `, ${errors.length} issue(s)` : "."}`, imported, skipped: errors.length, errors };
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
