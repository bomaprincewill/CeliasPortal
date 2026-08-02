// actions/results/compileResults.ts
// ============================================================
// Server Action: Result Compilation & Ranking Engine
//
// This action:
//  1. Validates caller is SUPER_ADMIN or FORM_TEACHER of class
//  2. Fetches all submitted results for the class/term
//  3. Computes totals, assigns letter grades & remarks
//  4. Ranks students by cumulative score within the class arm
//  5. Writes BroadSheet records atomically
//  6. Creates an audit log entry
// ============================================================

"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertClassAccess } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import type { Term, ResultStatus } from "@/types";
import { headers } from "next/headers";
import { hasExactSubjectAssignment } from "@/lib/authorization";

// ─── Grading Scale ────────────────────────────────────────────

interface GradeBand {
  min: number;
  max: number;
  grade: string;
  gradePoint: number;
  remark: string;
}

const GRADING_SCALE: GradeBand[] = [
  { min: 75, max: 100, grade: "A",  gradePoint: 4.0, remark: "Distinction"  },
  { min: 65, max: 74,  grade: "B",  gradePoint: 3.5, remark: "Credit"       },
  { min: 55, max: 64,  grade: "C",  gradePoint: 3.0, remark: "Merit"        },
  { min: 45, max: 54,  grade: "D",  gradePoint: 2.0, remark: "Pass"         },
  { min: 40, max: 44,  grade: "E",  gradePoint: 1.0, remark: "Weak Pass"    },
  { min: 0,  max: 39,  grade: "F",  gradePoint: 0.0, remark: "Fail"         },
];

function assignGrade(total: number): GradeBand {
  const band = GRADING_SCALE.find((b) => total >= b.min && total <= b.max);
  return band ?? GRADING_SCALE[GRADING_SCALE.length - 1]; // default F
}

// ─── Input / Output Types ─────────────────────────────────────

export interface CompileResultsInput {
  classId:   string;
  sessionId: string;
  term:      Term;
  /** If true, only re-ranks without changing existing grades */
  rankOnly?: boolean;
  /** If true, locks results after compilation (SUPER_ADMIN only) */
  lockAfter?: boolean;
}

export interface CompileResultsOutput {
  success: boolean;
  message: string;
  stats: {
    studentsProcessed: number;
    subjectsProcessed: number;
    topStudent?: { name: string; average: number };
    classAverage: number;
    passRate: number;
  };
  errors: string[];
}

// ─── Main Server Action ───────────────────────────────────────

export async function compileClassResults(
  input: CompileResultsInput
): Promise<CompileResultsOutput> {
  const errors: string[] = [];

  // ── 1. Auth & Authorization ─────────────────────────────────
  const session = await requireSession(["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL", "FORM_TEACHER"]);
  const { classId, sessionId, term, rankOnly = false, lockAfter = false } = input;
  await assertClassAccess(session.user.role, classId);

  // Form teacher can only compile their own class
  if (
    session.user.role === "FORM_TEACHER" &&
    session.user.formClassId !== classId
  ) {
    return {
      success: false,
      message: "You can only compile results for your own class.",
      stats: { studentsProcessed: 0, subjectsProcessed: 0, classAverage: 0, passRate: 0 },
      errors: ["Unauthorized: wrong class"],
    };
  }

  // Lock requires SUPER_ADMIN
  if (lockAfter && session.user.role !== "SUPER_ADMIN") {
    return {
      success: false,
      message: "Only Super Admin can lock results.",
      stats: { studentsProcessed: 0, subjectsProcessed: 0, classAverage: 0, passRate: 0 },
      errors: ["Insufficient permissions to lock"],
    };
  }

  // ── 2. Fetch class and students ──────────────────────────────
  const [classRecord, students] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId } }),
    prisma.student.findMany({
      where: { classId, isActive: true },
      select: { id: true, firstName: true, lastName: true, studentId: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  if (!classRecord) {
    return {
      success: false,
      message: "Class not found.",
      stats: { studentsProcessed: 0, subjectsProcessed: 0, classAverage: 0, passRate: 0 },
      errors: ["Class not found"],
    };
  }

  if (students.length === 0) {
    return {
      success: false,
      message: "No active students found in this class.",
      stats: { studentsProcessed: 0, subjectsProcessed: 0, classAverage: 0, passRate: 0 },
      errors: ["No students"],
    };
  }

  // ── 3. Fetch all SUBMITTED or APPROVED results for the class/term ──
  const results = await prisma.result.findMany({
    where: {
      classId,
      sessionId,
      term,
      status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] as ResultStatus[] },
    },
    include: {
      subject: { select: { name: true, code: true } },
    },
  });

  if (results.length === 0) {
    return {
      success: false,
      message: "No submitted results found. Teachers must submit scores first.",
      stats: { studentsProcessed: 0, subjectsProcessed: 0, classAverage: 0, passRate: 0 },
      errors: ["No submitted results"],
    };
  }

  // Get unique subjects
  const subjectIds = [...new Set(results.map((r) => r.subjectId))];

  // ── 4. Build student score map ────────────────────────────────
  //   { [studentId]: { total: X, subjects: [...], average: Y } }

  interface StudentSummary {
    studentId: string;
    name: string;
    subjectScores: { subjectId: string; total: number; grade: GradeBand }[];
    cumulativeTotal: number;
    average: number;
    subjectCount: number;
    position?: number;
  }

  const studentMap = new Map<string, StudentSummary>();

  for (const student of students) {
    studentMap.set(student.id, {
      studentId: student.id,
      name: `${student.lastName} ${student.firstName}`,
      subjectScores: [],
      cumulativeTotal: 0,
      average: 0,
      subjectCount: 0,
    });
  }

  // ── 5. Compute totals per result ──────────────────────────────
  const resultUpdates: {
    id: string;
    total: number;
    grade: string;
    gradePoint: number;
    remark: string;
    status: ResultStatus;
  }[] = [];

  for (const result of results) {
    if (!studentMap.has(result.studentId)) continue; // student may have moved class

    const ca1  = result.ca1  ?? 0;
    const ca2  = result.ca2  ?? 0;
    const ca3  = result.ca3  ?? 0;
    const exam = result.examScore ?? 0;
    const total = Math.min(
      ca1 + ca2 + ca3 + exam,
      result.maxTotal // cap at configured max
    );

    const band = assignGrade(total);

    if (!rankOnly) {
      resultUpdates.push({
        id:         result.id,
        total,
        grade:      band.grade,
        gradePoint: band.gradePoint,
        remark:     band.remark,
        status:     lockAfter ? "LOCKED" : result.status,
      });
    }

    const summary = studentMap.get(result.studentId)!;
    summary.subjectScores.push({ subjectId: result.subjectId, total, grade: band });
    summary.cumulativeTotal += total;
    summary.subjectCount    += 1;
  }

  // Compute averages
  for (const summary of studentMap.values()) {
    summary.average =
      summary.subjectCount > 0
        ? parseFloat((summary.cumulativeTotal / summary.subjectCount).toFixed(2))
        : 0;
  }

  // ── 6. Rank students by cumulative total (descending) ─────────
  const ranked = [...studentMap.values()]
    .filter((s) => s.subjectCount > 0)
    .sort((a, b) => {
      if (b.cumulativeTotal !== a.cumulativeTotal) return b.cumulativeTotal - a.cumulativeTotal;
      // Tiebreaker: alphabetical name
      return a.name.localeCompare(b.name);
    });

  let currentRank = 1;
  let prevTotal   = -1;
  let skipCount   = 0;

  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    if (s.cumulativeTotal !== prevTotal) {
      currentRank += skipCount;
      skipCount    = 1;
    } else {
      skipCount++;
    }
    s.position  = currentRank;
    prevTotal   = s.cumulativeTotal;
  }

  // ── 7. Per-subject ranking ────────────────────────────────────
  for (const subjectId of subjectIds) {
    const subjectResults = results.filter((r) => r.subjectId === subjectId);
    const sorted = subjectResults
      .map((r) => {
        const total = (r.ca1 ?? 0) + (r.ca2 ?? 0) + (r.ca3 ?? 0) + (r.examScore ?? 0);
        return { id: r.id, studentId: r.studentId, total };
      })
      .sort((a, b) => b.total - a.total);

    let rank = 1;
    let prev = -1;
    let skip = 0;
    for (const item of sorted) {
      if (item.total !== prev) { rank += skip; skip = 1; }
      else skip++;
      // Store per-subject rank in resultUpdates
      const update = resultUpdates.find((u) => u.id === item.id);
      if (update) {
        (update as typeof update & { position?: number }).position = rank;
      }
      prev = item.total;
    }
  }

  // ── 8. Write everything atomically ───────────────────────────
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  await prisma.$transaction(async (tx) => {
    // Update individual result records
    if (!rankOnly) {
      for (const update of resultUpdates) {
        const { id, ...data } = update;
        await tx.result.update({
          where: { id },
          data: {
            ...data,
            ...(data.status === "LOCKED" ? { lockedAt: new Date(), lockedById: session.user.id } : {}),
          },
        });
      }
    }

    // Upsert BroadSheet rows
    for (const summary of ranked) {
      await tx.broadSheet.upsert({
        where: {
          classId_sessionId_term_studentId: {
            classId,
            sessionId,
            term,
            studentId: summary.studentId,
          },
        },
        update: {
          totalScore:   summary.cumulativeTotal,
          averageScore: summary.average,
          subjectCount: summary.subjectCount,
          position:     summary.position,
          outOf:        ranked.length,
          isLocked:     lockAfter,
          computedAt:   new Date(),
          computedById: session.user.id,
        },
        create: {
          classId,
          sessionId,
          term,
          studentId:    summary.studentId,
          totalScore:   summary.cumulativeTotal,
          averageScore: summary.average,
          subjectCount: summary.subjectCount,
          position:     summary.position,
          outOf:        ranked.length,
          isLocked:     lockAfter,
          computedAt:   new Date(),
          computedById: session.user.id,
        },
      });
    }

    // Write audit log
    await tx.auditLog.create({
      data: {
        userId:      session.user.id,
        action:      lockAfter ? "LOCK" : "UPDATE",
        entity:      "Result",
        entityId:    classId,
        description: `Result compilation for ${classRecord.name} ${classRecord.arm}, ${term} Term ${sessionId}. ${ranked.length} students ranked across ${subjectIds.length} subjects.`,
        newValue: {
          studentsRanked: ranked.length,
          subjectsProcessed: subjectIds.length,
          locked: lockAfter,
        },
        ipAddress: ip,
      },
    });
  });

  // ── 9. Compute stats for response ────────────────────────────
  const classAverage =
    ranked.length > 0
      ? parseFloat(
          (ranked.reduce((sum, s) => sum + s.average, 0) / ranked.length).toFixed(2)
        )
      : 0;

  const passCount = ranked.filter((s) => s.average >= 40).length;
  const passRate  = ranked.length > 0 ? Math.round((passCount / ranked.length) * 100) : 0;
  const topStudent = ranked[0]
    ? { name: ranked[0].name, average: ranked[0].average }
    : undefined;

  // ── 10. Revalidate affected pages ────────────────────────────
  revalidatePath(`/teacher/broadsheet/${classId}`);
  revalidatePath(`/admin/results/${classId}`);

  return {
    success: true,
    message: `Results compiled successfully. ${ranked.length} students ranked.`,
    stats: {
      studentsProcessed: ranked.length,
      subjectsProcessed: subjectIds.length,
      topStudent,
      classAverage,
      passRate,
    },
    errors,
  };
}

// ─── Helper: Lock a single result (SUPER_ADMIN only) ─────────

export async function lockResult(resultId: string): Promise<{ success: boolean; message: string }> {
  const session = await requireSession(["SUPER_ADMIN"]);
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  const result = await prisma.result.findUnique({ where: { id: resultId } });
  if (!result) return { success: false, message: "Result not found." };
  if (result.status === "LOCKED") return { success: false, message: "Already locked." };

  await prisma.$transaction([
    prisma.result.update({
      where: { id: resultId },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: session.user.id },
    }),
    prisma.auditLog.create({
      data: {
        userId:      session.user.id,
        action:      "LOCK",
        entity:      "Result",
        entityId:    resultId,
        description: `Result locked by Super Admin`,
        oldValue:    { status: result.status },
        newValue:    { status: "LOCKED" },
        ipAddress:   ip,
      },
    }),
  ]);

  revalidatePath(`/admin/results`);
  return { success: true, message: "Result locked successfully." };
}

// ─── Helper: Submit results (Subject Teacher → Form Teacher) ──

export async function submitResultsForApproval(input: {
  classId: string;
  subjectId: string;
  sessionId: string;
  term: Term;
}): Promise<{ success: boolean; message: string; count: number }> {
  const session = await requireSession(["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"]);
  const { classId, subjectId, sessionId, term } = input;
  await assertClassAccess(session.user.role, classId);

  // Verify subject teacher ownership
  if (session.user.role === "SUBJECT_TEACHER") {
    const isAssigned = await hasExactSubjectAssignment(session.user.id, classId, subjectId);
    if (!isAssigned) return { success: false, message: "Not assigned to this class/subject.", count: 0 };
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  // Find all DRAFT results for this batch
  const drafts = await prisma.result.findMany({
    where: { classId, subjectId, sessionId, term, status: "DRAFT" },
    select: { id: true, studentId: true, total: true },
  });

  if (drafts.length === 0) {
    return { success: false, message: "No draft results found to submit.", count: 0 };
  }

  // Validate: all results must have at least an exam score
  const incomplete = drafts.filter((r) => r.total === null || r.total === undefined);
  if (incomplete.length > 0) {
    return {
      success: false,
      message: `${incomplete.length} student(s) have incomplete scores. Please fill all scores before submitting.`,
      count: 0,
    };
  }

  const ids = drafts.map((d) => d.id);

  await prisma.$transaction([
    prisma.result.updateMany({
      where: { id: { in: ids } },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId:      session.user.id,
        action:      "SUBMIT",
        entity:      "Result",
        description: `${drafts.length} results submitted for approval — class ${classId}, subject ${subjectId}, ${term} term`,
        newValue:    { ids, count: ids.length },
        ipAddress:   ip,
      },
    }),
  ]);

  revalidatePath(`/teacher/results/${classId}/${subjectId}`);
  return { success: true, message: `${ids.length} results submitted for approval.`, count: ids.length };
}
