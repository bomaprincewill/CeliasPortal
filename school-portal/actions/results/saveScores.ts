// actions/results/saveScores.ts
// ============================================================
// Server Action: Save / upsert score rows for a subject+class
// Called by the ResultInputGrid component.
// ============================================================

"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Term } from "@/types";
import { assertClassAccess } from "@/lib/roles";
import { hasExactSubjectAssignment } from "@/lib/authorization";

export interface ScoreRow {
  studentId: string;
  ca1:       number | null;
  ca2:       number | null;
  ca3:       number | null;
  examScore: number | null;
}

export interface SaveScoresInput {
  classId:   string;
  subjectId: string;
  sessionId: string;
  term:      Term;
  rows:      ScoreRow[];
  maxCA1?:   number;
  maxCA2?:   number;
  maxCA3?:   number;
  maxExam?:  number;
}

export interface SaveScoresOutput {
  success:  boolean;
  message:  string;
  saved:    number;
  errors:   { studentId: string; message: string }[];
}

export async function saveDraftScores(input: SaveScoresInput): Promise<SaveScoresOutput> {
  const session = await requireSession(["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"]);

  const {
    classId, subjectId, sessionId, term, rows,
    maxCA1 = 10, maxCA2 = 10, maxCA3 = 10, maxExam = 70,
  } = input;
  await assertClassAccess(session.user.role, classId);

  const maxTotal = maxCA1 + maxCA2 + maxCA3 + maxExam;

  // Verify ownership
  if (session.user.role === "SUBJECT_TEACHER") {
    const ok = await hasExactSubjectAssignment(session.user.id, classId, subjectId);
    if (!ok) return { success: false, message: "Access denied.", saved: 0, errors: [] };
  }
  if (session.user.role === "FORM_TEACHER" && session.user.formClassId !== classId) {
    return { success: false, message: "You can only save results for your form class.", saved: 0, errors: [] };
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  const validationErrors: { studentId: string; message: string }[] = [];
  let validRows: ScoreRow[] = [];

  // Validate each row
  for (const row of rows) {
    const rowErrors: string[] = [];
    if (row.ca1 !== null && (row.ca1 < 0 || row.ca1 > maxCA1))
      rowErrors.push(`CA1 must be 0–${maxCA1}`);
    if (row.ca2 !== null && (row.ca2 < 0 || row.ca2 > maxCA2))
      rowErrors.push(`CA2 must be 0–${maxCA2}`);
    if (row.ca3 !== null && (row.ca3 < 0 || row.ca3 > maxCA3))
      rowErrors.push(`CA3 must be 0–${maxCA3}`);
    if (row.examScore !== null && (row.examScore < 0 || row.examScore > maxExam))
      rowErrors.push(`Exam must be 0–${maxExam}`);

    if (rowErrors.length > 0) {
      validationErrors.push({ studentId: row.studentId, message: rowErrors.join("; ") });
    } else {
      validRows.push(row);
    }
  }

  if (validRows.length === 0) {
    return {
      success: false,
      message: "All rows have validation errors.",
      saved: 0,
      errors: validationErrors,
    };
  }

  const [classSession, enrolledStudents] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, sessionId }, select: { id: true } }),
    prisma.student.findMany({
      where: { id: { in: validRows.map(row => row.studentId) }, classId, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!classSession) {
    return { success: false, message: "The class does not belong to the selected academic session.", saved: 0, errors: [] };
  }
  const enrolledIds = new Set(enrolledStudents.map(student => student.id));
  for (const row of validRows) {
    if (!enrolledIds.has(row.studentId)) validationErrors.push({ studentId: row.studentId, message: "Student is not active in this class." });
  }
  validRows = validRows.filter(row => enrolledIds.has(row.studentId));
  if (validRows.length === 0) {
    return { success: false, message: "No valid enrolled students were supplied.", saved: 0, errors: validationErrors };
  }

  // Fetch existing results to detect changes for audit log
  const existing = await prisma.result.findMany({
    where: {
      classId, subjectId, sessionId, term,
      studentId: { in: validRows.map((r) => r.studentId) },
    },
    select: { id: true, studentId: true, ca1: true, ca2: true, ca3: true, examScore: true, total: true, status: true },
  });
  const existingMap = new Map(existing.map((e) => [e.studentId, e]));

  const auditEntries: {
    studentId: string;
    old: object;
    new: object;
  }[] = [];

  // Upsert all valid rows in a transaction
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      const ca1  = row.ca1  ?? 0;
      const ca2  = row.ca2  ?? 0;
      const ca3  = row.ca3  ?? 0;
      const exam = row.examScore ?? 0;
      const total = Math.min(ca1 + ca2 + ca3 + exam, maxTotal);

      const old = existingMap.get(row.studentId);

      // Don't overwrite LOCKED results
      if (old?.status === "LOCKED") {
        validationErrors.push({ studentId: row.studentId, message: "Result is locked and cannot be edited." });
        continue;
      }

      await tx.result.upsert({
        where: {
          studentId_subjectId_sessionId_term: {
            studentId: row.studentId,
            subjectId,
            sessionId,
            term,
          },
        },
        update: {
          ca1: row.ca1, ca2: row.ca2, ca3: row.ca3,
          examScore: row.examScore, total,
          maxCA1, maxCA2, maxCA3, maxExam, maxTotal,
          status: "DRAFT",
        },
        create: {
          studentId: row.studentId,
          classId, subjectId, sessionId, term,
          ca1: row.ca1, ca2: row.ca2, ca3: row.ca3,
          examScore: row.examScore, total,
          maxCA1, maxCA2, maxCA3, maxExam, maxTotal,
          status: "DRAFT",
        },
      });

      if (old) {
        const changed =
          old.ca1 !== row.ca1 || old.ca2 !== row.ca2 ||
          old.ca3 !== row.ca3 || old.examScore !== row.examScore;
        if (changed) {
          auditEntries.push({
            studentId: row.studentId,
            old: { ca1: old.ca1, ca2: old.ca2, ca3: old.ca3, examScore: old.examScore, total: old.total },
            new: { ca1: row.ca1, ca2: row.ca2, ca3: row.ca3, examScore: row.examScore, total },
          });
        }
      }
    }

    // Batch audit log
    if (auditEntries.length > 0) {
      await tx.auditLog.create({
        data: {
          userId:      session.user.id,
          action:      "UPDATE",
          entity:      "Result",
          entityId:    `${classId}:${subjectId}`,
          description: `Scores saved (draft) for ${validRows.length} students — ${term} term`,
          oldValue:    auditEntries.map((e) => ({ studentId: e.studentId, ...e.old })),
          newValue:    auditEntries.map((e) => ({ studentId: e.studentId, ...e.new })),
          ipAddress:   ip,
        },
      });
    }
  });

  revalidatePath(`/teacher/results/${classId}/${subjectId}`);

  const saved = validRows.length - validationErrors.filter((e) =>
    validRows.some((r) => r.studentId === e.studentId)
  ).length;

  return {
    success:  validationErrors.length === 0,
    message:  validationErrors.length === 0
      ? `${saved} scores saved as draft.`
      : `${saved} saved with ${validationErrors.length} error(s).`,
    saved,
    errors: validationErrors,
  };
}
