import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: examId, isPublished: true },
    include: {
      questions: {
        select: {
          id: true, type: true, text: true, marks: true,
          options: true, imageUrl: true,
          // Never expose correctAnswer to client
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!exam) return NextResponse.json({ error: "Exam not found or not published." }, { status: 404 });

  // Check scheduling
  const now = new Date();
  if (now < new Date(exam.scheduledStart))
    return NextResponse.json({ error: "This exam has not started yet." }, { status: 403 });
  if (now > new Date(exam.scheduledEnd))
    return NextResponse.json({ error: "This exam has ended." }, { status: 403 });

  // Resolve the signed-in candidate and enforce the exam audience.
  let applicantId: string | undefined;
  let studentId: string | undefined;
  if (exam.type === "ENTRANCE") {
    if (session.user.role !== "APPLICANT") {
      return NextResponse.json({ error: "This exam is only available to applicants." }, { status: 403 });
    }
    const applicant = await prisma.applicant.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!applicant) return NextResponse.json({ error: "Applicant record not found." }, { status: 404 });
    applicantId = applicant.id;

  } else {
    if (session.user.role !== "STUDENT" || !exam.classId) {
      return NextResponse.json({ error: "This exam is only available to students in its assigned class." }, { status: 403 });
    }
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, classId: true, isActive: true },
    });
    if (!student || !student.isActive || student.classId !== exam.classId) {
      return NextResponse.json({ error: "You are not a member of the class assigned to this exam." }, { status: 403 });
    }
    studentId = student.id;

  }

  const candidateWhere = studentId ? { studentId } : { applicantId: applicantId! };
  let submission;
  try {
    submission = await prisma.$transaction(async tx => {
      const inProgress = await tx.cBTSubmission.findFirst({ where: { examId: exam.id, ...candidateWhere, submittedAt: null }, orderBy: { attemptNumber: "desc" } });
      if (inProgress) return inProgress;
      const attempts = await tx.cBTSubmission.count({ where: { examId: exam.id, ...candidateWhere } });
      if (attempts >= exam.maxAttempts) throw new Error("MAX_ATTEMPTS");
      return tx.cBTSubmission.create({ data: { examId: exam.id, ...candidateWhere, attemptNumber: attempts + 1 } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "MAX_ATTEMPTS") return NextResponse.json({ error: "You have used all permitted attempts for this exam." }, { status: 403 });
    return NextResponse.json({ error: "An exam attempt could not be started. Please try again." }, { status: 409 });
  }

  // Shuffle questions if configured
  let questions = exam.questions;
  if (exam.shuffleQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  // Shuffle options for MCQ
  if (exam.shuffleOptions) {
    questions = questions.map(q => {
      if (q.type !== "MCQ" || !q.options) return q;
      const opts = [...(q.options as { id:string; text:string }[])].sort(() => Math.random() - 0.5);
      return { ...q, options: opts };
    });
  }

  return NextResponse.json({
    id:                   exam.id,
    title:                exam.title,
    durationMinutes:      exam.durationMinutes,
    passMark:             exam.passMark,
    instructions:         exam.instructions,
    showResultImmediately:exam.showResultImmediately,
    questions,
    applicantId,
    studentId,
    submissionId: submission.id,
    attemptNumber: submission.attemptNumber,
    attemptsRemaining: Math.max(0, exam.maxAttempts - submission.attemptNumber),
  });
}
