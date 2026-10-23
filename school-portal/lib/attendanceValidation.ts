import { z } from "zod";

export const termSchema = z.enum(["FIRST", "SECOND", "THIRD"]);
export const attendanceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid attendance date.");

export const attendanceInputSchema = z.object({
  classId: z.string().min(1),
  sessionId: z.string().min(1),
  term: termSchema,
  date: attendanceDateSchema,
  rows: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    note: z.string().trim().max(500),
  })).min(1).max(500),
}).refine(input => new Set(input.rows.map(row => row.studentId)).size === input.rows.length,
  "Each pupil must appear only once.");

export type AttendanceInput = z.infer<typeof attendanceInputSchema>;
