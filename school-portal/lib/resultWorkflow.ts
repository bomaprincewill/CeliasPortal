import { z } from "zod";
import { termSchema } from "./attendanceValidation";

export const resultBatchSchema = z.object({
  classId: z.string().min(1), subjectId: z.string().min(1), sessionId: z.string().min(1), term: termSchema,
});

export function hasCompleteScores(row: {
  ca1: number | null; ca2: number | null; ca3: number | null; examScore: number | null;
  maxCA1: number; maxCA2: number; maxCA3: number; maxExam: number;
}) {
  return ([[row.ca1, row.maxCA1], [row.ca2, row.maxCA2], [row.ca3, row.maxCA3], [row.examScore, row.maxExam]] as const)
    .every(([score, max]) => max === 0 ? score === null || score === 0 : score !== null && Number.isFinite(score) && score >= 0 && score <= max);
}
