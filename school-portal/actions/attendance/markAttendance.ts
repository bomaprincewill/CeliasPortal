"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertClassAccess, ADMIN_ROLES } from "@/lib/roles";
import { attendanceInputSchema, type AttendanceInput } from "@/lib/attendanceValidation";
import { revalidatePath } from "next/cache";

export async function markAttendance(input: AttendanceInput) {
  const session = await requireSession([...ADMIN_ROLES, "FORM_TEACHER"]);
  const parsed = attendanceInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  const data = parsed.data;
  await assertClassAccess(session.user.role, data.classId);

  try {
    const count = await prisma.$transaction(async tx => {
      const schoolClass = await tx.class.findUnique({ where: { id: data.classId }, include: { session: true, formTeacher: true } });
      if (!schoolClass || schoolClass.sessionId !== data.sessionId || !schoolClass.session.isCurrent) {
        throw new Error("Attendance can only be recorded for a class in the current session.");
      }
      if (session.user.role === "FORM_TEACHER" && schoolClass.formTeacher?.userId !== session.user.id) {
        throw new Error("You can only record attendance for your assigned form class.");
      }
      const date = new Date(`${data.date}T00:00:00.000Z`);
      if (data.date < schoolClass.session.startDate.toISOString().slice(0, 10) || data.date > schoolClass.session.endDate.toISOString().slice(0, 10)) {
        throw new Error("Choose a date within the current academic session.");
      }
      const enrolled = await tx.studentEnrollment.findMany({
        where: { classId: data.classId, sessionId: data.sessionId, status: "ACTIVE", student: { isActive: true }, studentId: { in: data.rows.map(row => row.studentId) } },
        select: { studentId: true },
      });
      if (enrolled.length !== data.rows.length) throw new Error("Attendance includes a pupil who is not actively enrolled in this class.");
      const previous = await tx.attendance.findMany({ where: { studentId: { in: data.rows.map(row => row.studentId) }, date } });
      if (previous.some(row => row.classId !== data.classId || row.sessionId !== data.sessionId || row.term !== data.term)) {
        throw new Error("Attendance already exists for this date in a different class, session, or term. Check the selected date and term.");
      }
      for (const row of data.rows) {
        const values = { classId: data.classId, sessionId: data.sessionId, term: data.term, status: row.status, note: row.note || null, takenById: session.user.id };
        await tx.attendance.upsert({
          where: { studentId_date: { studentId: row.studentId, date } },
          create: { ...values, studentId: row.studentId, date },
          update: values,
        });
      }
      await tx.auditLog.create({ data: {
        userId: session.user.id, action: "UPDATE", entity: "Attendance", entityId: data.classId,
        description: `Attendance saved for ${data.date}, ${data.term} term: ${data.rows.length} pupils.`,
        oldValue: previous.map(row => ({ studentId: row.studentId, status: row.status, note: row.note })),
        newValue: { date: data.date, term: data.term, rows: data.rows }, sessionId: data.sessionId,
      } });
      return data.rows.length;
    }, { isolationLevel: "Serializable", timeout: 30000 });
    revalidatePath("/teacher/attendance");
    revalidatePath("/admin/attendance");
    revalidatePath("/student/attendance");
    return { success: true, message: `Attendance saved for ${data.date} (${count} pupils).` };
  } catch (error) {
    console.error("Attendance save failed", error);
    return { success: false, message: error instanceof Error && !error.message.includes("\n") ? error.message : "Attendance could not be saved. Please try again." };
  }
}
