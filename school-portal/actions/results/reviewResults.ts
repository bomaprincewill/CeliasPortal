"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, assertClassAccess } from "@/lib/roles";
import { hasCompleteScores, resultBatchSchema } from "@/lib/resultWorkflow";
import { revalidatePath } from "next/cache";
import type { Term } from "@/types";

type BatchInput = { classId: string; subjectId: string; sessionId: string; term: Term };

async function reviewBatch(input: BatchInput, lock: boolean) {
  const session = await requireSession(lock ? ["SUPER_ADMIN"] : ADMIN_ROLES);
  const parsed = resultBatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Select a valid class, subject, session, and term." };
  const batch = parsed.data;
  await assertClassAccess(session.user.role, batch.classId);
  try {
    const count = await prisma.$transaction(async tx => {
      const schoolClass = await tx.class.findUnique({ where: { id: batch.classId } });
      if (!schoolClass || schoolClass.sessionId !== batch.sessionId) throw new Error("Class does not belong to the selected session.");
      const rows = await tx.result.findMany({ where: { ...batch, status: lock ? "APPROVED" : "SUBMITTED" } });
      if (!rows.length) throw new Error(lock ? "No approved results to lock." : "No submitted results to approve.");
      if (rows.some(row => !hasCompleteScores(row))) throw new Error("Complete all required score components before approval or locking.");
      if (lock && rows.some(row => row.grade === null || row.position === null || row.total === null)) {
        throw new Error("Compile the class broadsheet before locking results.");
      }
      const lockedSheets = await tx.broadSheet.count({ where: { classId: batch.classId, sessionId: batch.sessionId, term: batch.term, isLocked: true, studentId: { in: rows.map(row => row.studentId) } } });
      if (lockedSheets) throw new Error("A published report is locked. Its results cannot be changed.");
      const changed = await tx.result.updateMany({
        where: { ...batch, id: { in: rows.map(row => row.id) }, status: lock ? "APPROVED" : "SUBMITTED" },
        data: lock ? { status: "LOCKED", lockedAt: new Date(), lockedById: session.user.id } : { status: "APPROVED", approvedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        userId: session.user.id, action: lock ? "LOCK" : "APPROVE", entity: "Result", entityId: batch.classId,
        description: `${changed.count} results ${lock ? "locked" : "approved"} for subject ${batch.subjectId}, ${batch.term} term.`,
        newValue: { ...batch, count: changed.count, status: lock ? "LOCKED" : "APPROVED" },
      } });
      return changed.count;
    }, { isolationLevel: "Serializable" });
    revalidatePath("/admin/results");
    revalidatePath(`/teacher/results/${batch.classId}/${batch.subjectId}`);
    revalidatePath(`/teacher/broadsheet/${batch.classId}`);
    return { success: true, message: `${count} results ${lock ? "locked" : "approved"}.` };
  } catch (error) {
    console.error("Result review failed", error);
    return { success: false, message: error instanceof Error && !error.message.includes("\n") ? error.message : "Results could not be updated. Please try again." };
  }
}

export async function approveResults(input: BatchInput) { return reviewBatch(input, false); }
export async function lockResultsBatch(input: BatchInput) { return reviewBatch(input, true); }
