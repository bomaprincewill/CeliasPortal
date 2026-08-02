"use server";

import bcrypt from "bcryptjs";
import mammoth from "mammoth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const VALID_ROLES = new Set<Role>([
  "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL",
  "FORM_TEACHER", "SUBJECT_TEACHER", "PARENT", "STUDENT",
]);

const ROLE_ALIASES: Record<string, Role> = {
  SUPERADMIN: "SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  SCHOOLADMIN: "ADMIN",
  SCHOOL_ADMIN: "ADMIN",
  ADMIN: "ADMIN",
  NURSERYHEAD: "NURSERY_HEAD",
  NURSERY_HEAD: "NURSERY_HEAD",
  PRIMARYHEAD: "PRIMARY_HEAD",
  PRIMARY_HEAD: "PRIMARY_HEAD",
  PRINCIPAL: "PRINCIPAL",
  SECONDARYPRINCIPAL: "PRINCIPAL",
  SECONDARY_PRINCIPAL: "PRINCIPAL",
  FORMTEACHER: "FORM_TEACHER",
  FORM_TEACHER: "FORM_TEACHER",
  SUBJECTTEACHER: "SUBJECT_TEACHER",
  SUBJECT_TEACHER: "SUBJECT_TEACHER",
  PARENT: "PARENT",
  PUPIL: "STUDENT",
  STUDENT: "STUDENT",
  LEARNER: "STUDENT",
};

function textFromHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeRole(value: string): Role | null {
  const key = value.toUpperCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] ?? ROLE_ALIASES[key.replaceAll("_", "")] ?? null;
}

export async function bulkUploadUsers(formData: FormData) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return { success: false, message: "Unauthorized.", users: [], errors: [] };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Select a Word document.", users: [], errors: [] };
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { success: false, message: "Only Word .docx files are supported.", users: [], errors: [] };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, message: "The Word document must be 10 MB or smaller.", users: [], errors: [] };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const converted = await mammoth.convertToHtml({ buffer });
    const matrix = [...converted.value.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textFromHtml(cell[1]))
    );

    if (matrix.length < 2) {
      return { success: false, message: "No user table was found in the Word document.", users: [], errors: [] };
    }
    if (matrix.length > 501) {
      return { success: false, message: "A maximum of 500 users can be uploaded at once.", users: [], errors: [] };
    }

    const headers = matrix[0].map(normalizeHeader);
    const nameIndex = headers.findIndex((header) => ["name", "fullname"].includes(header));
    const emailIndex = headers.indexOf("email");
    const passwordIndex = headers.findIndex((header) => ["password", "initialpassword"].includes(header));
    const roleIndex = headers.indexOf("role");
    const studentIdIndex = headers.findIndex((header) =>
      ["studentid", "pupilid", "admissionno", "admissionnumber", "registrationno", "regno"].includes(header)
    );
    if ([nameIndex, emailIndex, passwordIndex, roleIndex].some((index) => index < 0)) {
      return {
        success: false,
        message: "The table must contain Name, Email, Password, and Role columns.",
        users: [],
        errors: [],
      };
    }

    const createdUsers: Array<{ id: string; name: string; email: string; role: Role; isActive: boolean; createdAt: string }> = [];
    const errors: string[] = [];
    const emailsInFile = new Set<string>();

    for (let index = 1; index < matrix.length; index++) {
      const rowNumber = index + 1;
      const row = matrix[index];
      const name = (row[nameIndex] ?? "").trim();
      const email = (row[emailIndex] ?? "").trim().toLowerCase();
      const password = (row[passwordIndex] ?? "").trim();
      const role = normalizeRole(row[roleIndex] ?? "");
      const studentId = studentIdIndex >= 0 ? (row[studentIdIndex] ?? "").trim() : "";

      if (!row.some((cell) => cell.trim())) continue;
      if (!name) { errors.push(`Row ${rowNumber}: Name is required.`); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`Row ${rowNumber}: Invalid email.`); continue; }
      if (password.length < 8) { errors.push(`Row ${rowNumber}: Password must be at least 8 characters.`); continue; }
      if (!role || !VALID_ROLES.has(role)) { errors.push(`Row ${rowNumber}: Invalid or unsupported role.`); continue; }
      if (role === "STUDENT" && !studentId) {
        errors.push(`Row ${rowNumber}: Student ID/Admission No is required for a pupil or student account.`);
        continue;
      }
      if (session.user.role === "ADMIN" && role === "SUPER_ADMIN") {
        errors.push(`Row ${rowNumber}: Only a Super Admin can create another Super Admin.`);
        continue;
      }
      if (emailsInFile.has(email)) { errors.push(`Row ${rowNumber}: Duplicate email in document.`); continue; }
      emailsInFile.add(email);

      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        errors.push(`Row ${rowNumber}: ${email} already exists.`);
        continue;
      }
      if (role === "STUDENT") {
        const learner = await prisma.student.findUnique({
          where: { studentId },
          select: { userId: true, class: { select: { level: true } } },
        });
        if (!learner) {
          errors.push(`Row ${rowNumber}: No pupil/student record has the ID ${studentId}.`);
          continue;
        }
        if (learner.userId) {
          errors.push(`Row ${rowNumber}: ${studentId} already has a user account.`);
          continue;
        }
        if (learner.class?.level.toLowerCase() === "nursery") {
          errors.push(`Row ${rowNumber}: Nursery pupils do not receive user accounts; link the pupil to a parent account instead.`);
          continue;
        }
      }

      try {
        const passwordHash = await bcrypt.hash(password, 12);
        const created = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { name, email, passwordHash, role } });
          if (role === "FORM_TEACHER" || role === "SUBJECT_TEACHER") {
            await tx.teacher.create({
              data: { userId: user.id, employeeId: `EMP/${new Date().getFullYear()}/${randomBytes(4).toString("hex").toUpperCase()}` },
            });
          } else if (role === "PARENT") {
            await tx.parent.create({ data: { userId: user.id, relationship: "PARENT" } });
          } else if (role === "STUDENT") {
            await tx.student.update({ where: { studentId }, data: { userId: user.id } });
          }
          return user;
        });
        createdUsers.push({ ...created, createdAt: created.createdAt.toISOString() });
      } catch {
        errors.push(`Row ${rowNumber}: Could not create ${email}.`);
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "UPLOAD",
      entity: "User",
      description: `Bulk user upload: ${createdUsers.length} created, ${errors.length} skipped`,
      newValue: { created: createdUsers.map((user) => ({ email: user.email, role: user.role })), skipped: errors.length },
    });
    revalidatePath("/admin/users");

    return {
      success: createdUsers.length > 0,
      message: `${createdUsers.length} user${createdUsers.length === 1 ? "" : "s"} created; ${errors.length} row${errors.length === 1 ? "" : "s"} skipped.`,
      users: createdUsers,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "The Word document could not be read.",
      users: [],
      errors: [],
    };
  }
}
