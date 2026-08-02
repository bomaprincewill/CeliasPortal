// actions/cbt/submitExam.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { headers } from "next/headers";

export interface SubmitExamInput {
  examId:      string;
  submissionId: string;
  answers:     Record<string, string>; // questionId → answer value
  isApplicant?: boolean;
  applicantId?: string;
}

export interface SubmitExamResult {
  success:       boolean;
  submissionId:  string;
  score:         number;
  total:         number;
  percentage:    number;
  passed:        boolean;
  message:       string;
  answers: {
    questionId:   string;
    isCorrect:    boolean | null;
    marksAwarded: number;
    correctAnswer?: string;
    yourAnswer?:   string;
  }[];
  resultReleased?: boolean;
}

export async function submitCBTExam(input: SubmitExamInput): Promise<SubmitExamResult> {
  const headersList = await headers();
  const ip          = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua          = headersList.get("user-agent") ?? undefined;

  const session = await getSession();

  // Load exam + questions
  const exam = await prisma.exam.findUnique({
    where: { id: input.examId },
    include: {
      questions: {
        select: {
          id: true, type: true, marks: true,
          correctAnswer: true, options: true,
          keywords: true, sampleAnswer: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!exam) return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "Exam not found.", answers: [] };

  if (!session?.user || !exam.isPublished) {
    return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "You are not allowed to submit this exam.", answers: [] };
  }

  const now = new Date();
  if (now < exam.scheduledStart || now > exam.scheduledEnd) {
    return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "This exam is not currently available.", answers: [] };
  }

  let studentId: string | null = null;
  let applicantId: string | null = null;
  if (exam.type === "ENTRANCE") {
    if (session.user.role !== "APPLICANT") {
      return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "This exam is only available to applicants.", answers: [] };
    }
    const applicant = await prisma.applicant.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    applicantId = applicant?.id ?? null;
    if (!applicantId) {
      return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "Applicant record not found.", answers: [] };
    }
  } else {
    if (session.user.role !== "STUDENT" || !exam.classId) {
      return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "This exam is only available to its assigned class.", answers: [] };
    }
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, classId: true, isActive: true },
    });
    if (!student || !student.isActive || student.classId !== exam.classId) {
      return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "You are not a member of the class assigned to this exam.", answers: [] };
    }
    studentId = student.id;
  }

  const reservedSubmission = await prisma.cBTSubmission.findFirst({ where: {
    id: input.submissionId, examId: exam.id, submittedAt: null,
    ...(studentId ? { studentId } : { applicantId: applicantId! }),
  } });
  if (!reservedSubmission) return { success: false, submissionId: "", score: 0, total: 0, percentage: 0, passed: false, message: "This exam attempt is invalid or has already been submitted.", answers: [] };

  // Grade each question
  let rawScore    = 0;
  let totalMarks  = 0;
  const answerResults: SubmitExamResult["answers"] = [];
  let needsManualGrading = false;

  for (const q of exam.questions) {
    const submitted = input.answers[q.id];
    totalMarks += q.marks;

    let isCorrect:    boolean | null = null;
    let marksAwarded: number = 0;
    let correctAnswer: string | undefined;
    let yourAnswer:    string | undefined;

    if (q.type === "MCQ") {
      isCorrect    = submitted === q.correctAnswer;
      marksAwarded = isCorrect ? q.marks : 0;
      // Find option text
      const opts   = q.options as { id: string; text: string }[] | null;
      yourAnswer   = opts?.find(o => o.id === submitted)?.text;
      correctAnswer= opts?.find(o => o.id === q.correctAnswer)?.text;
    } else if (q.type === "TRUE_FALSE") {
      isCorrect    = submitted?.toLowerCase() === q.correctAnswer?.toLowerCase();
      marksAwarded = isCorrect ? q.marks : 0;
      yourAnswer   = submitted;
      correctAnswer= q.correctAnswer ?? undefined;
    } else if (q.type === "SHORT_ANSWER") {
      // Auto-grade via keywords if available
      if (q.keywords && q.keywords.length > 0 && submitted) {
        const submittedLower = submitted.toLowerCase();
        const matched = q.keywords.filter(k => submittedLower.includes(k.toLowerCase()));
        const ratio   = matched.length / q.keywords.length;
        marksAwarded  = Math.round(ratio * q.marks);
        isCorrect     = ratio >= 0.6;
      } else {
        isCorrect = null; // needs manual grading
        needsManualGrading = true;
      }
      yourAnswer = submitted;
    } else {
      // ESSAY — always needs manual grading
      isCorrect = null;
      needsManualGrading = true;
      yourAnswer = submitted;
    }

    rawScore += marksAwarded;

    answerResults.push({
      questionId:   q.id,
      isCorrect,
      marksAwarded,
      correctAnswer,
      yourAnswer,
    });
  }

  const percentage = totalMarks > 0 ? Math.round((rawScore / totalMarks) * 100) : 0;
  const passed     = !needsManualGrading && percentage >= exam.passMark;

  // Upsert submission + answers atomically
  const submission = await prisma.$transaction(async (tx) => {
    const claimed = await tx.cBTSubmission.updateMany({
      where: { id: reservedSubmission.id, submittedAt: null },
      data: {
        submittedAt: new Date(),
        rawScore, totalMarks, percentage, isPassed: needsManualGrading ? null : passed,
        ipAddress: ip, userAgent: ua,
        timeUsedSeconds: null,
        gradingStatus: needsManualGrading ? "PENDING_MANUAL" : "AUTO_GRADED",
        finalizedAt: needsManualGrading ? null : new Date(),
      },
    });
    if (claimed.count !== 1) throw new Error("ATTEMPT_ALREADY_SUBMITTED");
    const sub = reservedSubmission;

    // Write answer rows
    for (const a of answerResults) {
      await tx.cBTAnswer.upsert({
        where: { submissionId_questionId: { submissionId: sub.id, questionId: a.questionId } },
        update: { value: input.answers[a.questionId] ?? null, isCorrect: a.isCorrect, marksAwarded: a.marksAwarded },
        create: {
          submissionId: sub.id,
          questionId:   a.questionId,
          value:        input.answers[a.questionId] ?? null,
          isCorrect:    a.isCorrect,
          marksAwarded: a.marksAwarded,
        },
      });
    }

    // Update applicant admission score if entrance exam
    if (exam.type === "ENTRANCE" && applicantId && !needsManualGrading) {
      await tx.applicant.update({
        where: { id: applicantId },
        data:  { admissionScore: rawScore },
      });
    }

    return sub;
  });

  await writeAuditLog({
    userId:      session?.user.id ?? null,
    action:      "SUBMIT",
    entity:      "CBTSubmission",
    entityId:    submission.id,
    description: `CBT exam submitted — "${exam.title}" — ${percentage}% (${rawScore}/${totalMarks})`,
    newValue:    { examId: exam.id, score: rawScore, total: totalMarks, percentage, passed },
    metadata:    { ip, ua },
  });

  if (!exam.showResultImmediately || needsManualGrading) {
    return {
      success: true, submissionId: submission.id, score: 0, total: 0,
      percentage: 0, passed: false, message: needsManualGrading ? "Exam submitted successfully. Written answers are awaiting review." : "Exam submitted successfully. Results will be released later.",
      answers: [], resultReleased: false,
    };
  }

  return {
    success:     true,
    submissionId: submission.id,
    score:       rawScore,
    total:       totalMarks,
    percentage,
    passed,
    message:     `Exam submitted. Score: ${percentage}%`,
    answers:     answerResults,
    resultReleased: true,
  };
}
