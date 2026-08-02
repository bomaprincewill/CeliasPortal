// types/index.ts
export type Role = "SUPER_ADMIN" | "ADMIN" | "BURSAR_ACCOUNTANT" | "SECRETARY" | "NURSERY_HEAD" | "PRIMARY_HEAD" | "PRINCIPAL" | "FORM_TEACHER" | "SUBJECT_TEACHER" | "PARENT" | "APPLICANT" | "STUDENT";
export type Term = "FIRST" | "SECOND" | "THIRD";
export type ResultStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "LOCKED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type AdmissionStatus = "PENDING" | "OFFERED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type ExamType = "TERMINAL" | "ENTRANCE" | "MOCK" | "CA";
export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "SUBMIT" | "APPROVE" | "LOCK" | "UNLOCK" | "UPLOAD";

export interface GradeBand {
  min: number; max: number;
  grade: string; gradePoint: number; remark: string;
}

export const GRADING_SCALE: GradeBand[] = [
  { min: 75, max: 100, grade: "A", gradePoint: 4.0, remark: "Distinction" },
  { min: 65, max: 74,  grade: "B", gradePoint: 3.5, remark: "Credit"      },
  { min: 55, max: 64,  grade: "C", gradePoint: 3.0, remark: "Merit"       },
  { min: 45, max: 54,  grade: "D", gradePoint: 2.0, remark: "Pass"        },
  { min: 40, max: 44,  grade: "E", gradePoint: 1.0, remark: "Weak Pass"   },
  { min: 0,  max: 39,  grade: "F", gradePoint: 0.0, remark: "Fail"        },
];

export function assignGrade(total: number): GradeBand {
  return GRADING_SCALE.find(b => total >= b.min && total <= b.max) ?? GRADING_SCALE[GRADING_SCALE.length - 1];
}

export function gradeColor(grade: string): string {
  return { A:"text-emerald-600", B:"text-blue-600", C:"text-cyan-600", D:"text-yellow-600", E:"text-orange-500", F:"text-red-600" }[grade] ?? "text-muted";
}

export function gradeBg(grade: string): string {
  return { A:"bg-emerald-50 text-emerald-700 border-emerald-200", B:"bg-blue-50 text-blue-700 border-blue-200", C:"bg-cyan-50 text-cyan-700 border-cyan-200", D:"bg-yellow-50 text-yellow-700 border-yellow-200", E:"bg-orange-50 text-orange-700 border-orange-200", F:"bg-red-50 text-red-700 border-red-200" }[grade] ?? "bg-slate-50 text-slate-600 border-slate-200";
}

export function scoreColor(pct: number) {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

export const TERM_LABELS: Record<Term, string> = { FIRST: "1st Term", SECOND: "2nd Term", THIRD: "3rd Term" };
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:"Super Admin",
  ADMIN:"School Admin",
  BURSAR_ACCOUNTANT:"Bursar / Accountant",
  SECRETARY:"Secretary",
  NURSERY_HEAD:"Nursery Head",
  PRIMARY_HEAD:"Primary Head",
  PRINCIPAL:"Secondary Principal",
  FORM_TEACHER:"Form Teacher",
  SUBJECT_TEACHER:"Subject Teacher",
  PARENT:"Parent",
  APPLICANT:"Applicant",
  STUDENT:"Student",
};
