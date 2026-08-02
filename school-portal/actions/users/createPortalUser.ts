"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { randomBytes } from "crypto";

export type CreatePortalUserInput = {
  role: "PARENT" | "APPLICANT";
  email: string;
  password: string;
  phone?: string;
  name?: string;
  relationship?: string;
  occupation?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  applyingForClass?: string;
  academicSession?: string;
  address?: string;
};

export async function createPortalUser(input: CreatePortalUserInput) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return { success: false, error: "Unauthorized." };
  if (session.user.role === "ADMIN" && input.role !== "APPLICANT") {
    return { success: false, error: "School Admin can only generate applicant accounts." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { success: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { success: false, error: "Password must be at least 8 characters." };
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { success: false, error: "A user with this email already exists." };
  }

  if (input.role === "PARENT" && !input.name?.trim()) return { success: false, error: "Parent name is required." };
  if (input.role === "APPLICANT" && (!input.firstName?.trim() || !input.lastName?.trim() || !input.dateOfBirth || !input.applyingForClass || !input.academicSession)) {
    return { success: false, error: "Complete all required applicant fields." };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const displayName = input.role === "PARENT"
    ? input.name!.trim()
    : `${input.firstName!.trim()} ${input.lastName!.trim()}`;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, passwordHash, name: displayName, phone: input.phone?.trim() || null, role: input.role, isActive: input.role !== "APPLICANT" },
    });

    if (input.role === "PARENT") {
      await tx.parent.create({
        data: {
          userId: created.id,
          relationship: input.relationship?.trim() || "PARENT",
          occupation: input.occupation?.trim() || null,
        },
      });
    } else {
      const applicationNo = `APP/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
      await tx.applicant.create({
        data: {
          userId: created.id,
          applicationNo,
          firstName: input.firstName!.trim(),
          lastName: input.lastName!.trim(),
          middleName: input.middleName?.trim() || null,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          gender: input.gender ?? "MALE",
          applyingForClass: input.applyingForClass!,
          academicSession: input.academicSession!,
          address: input.address?.trim() || null,
        },
      });
    }
    return created;
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    description: `${input.role === "PARENT" ? "Parent" : "Applicant"} account created for ${displayName}`,
    newValue: { email, role: input.role },
  });

  return {
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
  };
}

export async function generateApplicantAccount(input: Omit<CreatePortalUserInput, "role" | "password">) {
  const password = `App!${randomBytes(9).toString("base64url")}`;
  const result = await createPortalUser({ ...input, role: "APPLICANT", password });
  if (!result.success || !result.user) return result;

  const applicant = await prisma.applicant.findUnique({
    where: { userId: result.user.id },
    select: { applicationNo: true, applyingForClass: true, status: true },
  });
  if (!applicant) return { success: false, error: "Applicant profile could not be loaded after creation." };
  return { ...result, user: { ...result.user, applicant, isActive: false } };
}
