import { z } from "zod";
import { attendanceDateSchema } from "./attendanceValidation";

export const schoolUserSchema = z.object({
  name: z.string().trim().min(1).max(150), email: z.string().trim().toLowerCase().email(), password: z.string().min(12).max(128),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL", "FORM_TEACHER", "SUBJECT_TEACHER", "STUDENT"]),
  classId: z.string().default(""), subjectIds: z.array(z.string().min(1)).max(100).default([]),
  firstName: z.string().trim().max(80).optional(), lastName: z.string().trim().max(80).optional(), middleName: z.string().trim().max(80).optional(),
  admissionNumber: z.string().trim().max(50).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(), dateOfBirth: z.union([z.literal(""), attendanceDateSchema]).optional(),
}).superRefine((data, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (data.role === "STUDENT" && (!data.firstName || !data.lastName || !data.admissionNumber || !data.gender || !data.classId)) issue("Enter the learner's first name, last name, admission number, gender, and class.");
  if (data.role === "FORM_TEACHER" && !data.classId) issue("Choose the form teacher's class.");
  if (data.subjectIds.length && (!["FORM_TEACHER", "SUBJECT_TEACHER"].includes(data.role) || !data.classId)) issue("Choose a class for these teaching assignments.");
  if (new Set(data.subjectIds).size !== data.subjectIds.length) issue("Choose each subject only once.");
});

export type SchoolUserInput = z.input<typeof schoolUserSchema>;
