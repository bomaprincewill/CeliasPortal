"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasExactSubjectAssignment } from "@/lib/authorization";

interface ParsedQuestion {
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  marks: number;
}

function parseQuestions(text: string): ParsedQuestion[] {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const questions: ParsedQuestion[] = [];
  let current: Partial<ParsedQuestion> | null = null;

  const finish = () => {
    if (!current) return;
    if (!current.text || !current.options || current.options.length < 2 || !current.correctAnswer) {
      throw new Error(`Question ${questions.length + 1} is incomplete. Each question needs at least two options and an Answer line.`);
    }
    if (!current.options.some((option) => option.id === current.correctAnswer)) {
      throw new Error(`Question ${questions.length + 1} has an answer that does not match any option.`);
    }
    questions.push({
      text: current.text,
      options: current.options,
      correctAnswer: current.correctAnswer,
      explanation: current.explanation,
      marks: current.marks ?? 1,
    });
  };

  for (const line of lines) {
    const questionMatch = line.match(/^(?:question\s*)?(\d+)[.):\-]\s*(.+)$/i);
    const optionMatch = line.match(/^([A-H])[.):\-]\s*(.+)$/i);
    const answerMatch = line.match(/^answer\s*:\s*([A-H])(?:[.):\s].*)?$/i);
    const explanationMatch = line.match(/^explanation\s*:\s*(.+)$/i);
    const marksMatch = line.match(/^marks?\s*:\s*(\d+(?:\.\d+)?)$/i);

    if (questionMatch) {
      finish();
      current = { text: questionMatch[2], options: [], marks: 1 };
    } else if (optionMatch && current) {
      current.options!.push({ id: optionMatch[1].toUpperCase(), text: optionMatch[2] });
    } else if (answerMatch && current) {
      current.correctAnswer = answerMatch[1].toUpperCase();
    } else if (explanationMatch && current) {
      current.explanation = explanationMatch[1];
    } else if (marksMatch && current) {
      current.marks = Math.max(1, Math.round(Number(marksMatch[1])));
    } else if (current && current.text && current.options?.length === 0) {
      current.text += ` ${line}`;
    }
  }
  finish();

  if (questions.length === 0) {
    throw new Error("No questions were found in the Word document.");
  }
  return questions;
}

export async function createCBTExamFromWord(formData: FormData) {
  const session = await requireSession(["FORM_TEACHER", "SUBJECT_TEACHER"]);
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "") || null;
  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  const passMark = Number(formData.get("passMark") ?? 50);
  const scheduledStart = new Date(String(formData.get("scheduledStart") ?? ""));
  const scheduledEnd = new Date(String(formData.get("scheduledEnd") ?? ""));
  const isPublished = formData.get("isPublished") === "on";

  if (!title) return { success: false, message: "Exam title is required." };
  if (!sessionId) return { success: false, message: "Academic session is required." };
  if (!classId) return { success: false, message: "Select the class that should receive this exam." };
  if (!(file instanceof File) || file.size === 0) return { success: false, message: "Select a Word (.docx) file." };
  if (!file.name.toLowerCase().endsWith(".docx")) return { success: false, message: "Only .docx Word files are supported." };
  if (file.size > 10 * 1024 * 1024) return { success: false, message: "The Word file must be 10 MB or smaller." };
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
    return { success: false, message: "Duration must be between 1 and 480 minutes." };
  }
  if (!Number.isFinite(passMark) || passMark < 0 || passMark > 100) {
    return { success: false, message: "Pass mark must be between 0 and 100." };
  }
  if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
    return { success: false, message: "Enter a valid exam start and end time." };
  }

  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: {
        formClassId: true,
        assignments: { select: { classId: true, subjectId: true } },
      },
    });
    if (!teacher) return { success: false, message: "Teacher profile not found." };

    const allowedClassIds = new Set(teacher.assignments.map((assignment) => assignment.classId));
    if (session.user.role === "FORM_TEACHER" && teacher.formClassId) {
      allowedClassIds.add(teacher.formClassId);
    }
    const allowedSubjectIds = new Set(teacher.assignments.map((assignment) => assignment.subjectId));

    if (!allowedClassIds.has(classId)) {
      return { success: false, message: "You can only create a CBT for a class assigned to you." };
    }
    if (subjectId && (!allowedSubjectIds.has(subjectId) || !await hasExactSubjectAssignment(session.user.id, classId, subjectId))) {
      return { success: false, message: "You can only select a subject assigned to you." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await mammoth.extractRawText({ buffer });
    const questions = parseQuestions(extracted.value);
    const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          title,
          description: String(formData.get("description") ?? "").trim() || null,
          type: "TERMINAL",
          sessionId,
          classId,
          subjectId,
          term: String(formData.get("term") ?? "FIRST") as "FIRST" | "SECOND" | "THIRD",
          durationMinutes,
          scheduledStart,
          scheduledEnd,
          passMark: Math.round(passMark),
          totalMarks,
          instructions: String(formData.get("instructions") ?? "").trim() || null,
          isPublished,
          createdById: session.user.id,
        },
      });

      await tx.question.createMany({
        data: questions.map((question, index) => ({
          examId: created.id,
          subjectId,
          type: "MCQ",
          text: question.text,
          marks: question.marks,
          order: index + 1,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          keywords: [],
        })),
      });
      return created;
    });

    revalidatePath("/teacher/exams");
    return { success: true, message: `Exam created with ${questions.length} questions.`, examId: exam.id };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Could not import the Word document." };
  }
}
