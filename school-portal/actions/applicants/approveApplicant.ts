"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sendApplicantSetupEmail } from "@/lib/email";

const buildSetup = (token: string, applicant: { name: string; email: string; applicant: { applicationNo: string; applyingForClass: string } }) => {
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    url: `${baseUrl}/auth/reset-password/${encodeURIComponent(token)}`,
    name: applicant.name,
    email: applicant.email,
    applicationNo: applicant.applicant.applicationNo,
    applyingForClass: applicant.applicant.applyingForClass,
  };
};

export async function approveApplicant(userId: string) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return { success: false, error: "Unauthorized." };

  const applicantUser = await prisma.user.findFirst({
    where: { id: userId, role: "APPLICANT" },
    select: { id: true, name: true, email: true, isActive: true, applicant: { select: { id: true, applicationNo: true, applyingForClass: true } } },
  });
  if (!applicantUser?.applicant) return { success: false, error: "Applicant not found." };
  if (applicantUser.isActive) return { success: false, error: "This applicant account has already been approved." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: applicantUser.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: applicantUser.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } }),
    prisma.user.update({ where: { id: applicantUser.id }, data: { isActive: true } }),
  ]);
  const setup = buildSetup(token, applicantUser);
  const delivery = await sendApplicantSetupEmail({
    to: setup.email, name: setup.name, setupUrl: setup.url,
    applicationNo: setup.applicationNo, applyingForClass: setup.applyingForClass,
    deliveryId: tokenHash,
  });
  await writeAuditLog({
    userId: session.user.id, action: "APPROVE", entity: "Applicant", entityId: applicantUser.applicant.id,
    description: `Applicant account approved and a one-time setup link generated`,
    newValue: { applicationNo: applicantUser.applicant.applicationNo, setupLinkGenerated: true },
  });
  revalidatePath("/admin/applicants");
  return {
    success: true,
    setup,
    emailSent: delivery.sent,
    emailError: delivery.sent ? undefined : delivery.error,
  };
}

export async function sendApplicantCredentials(userId: string) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) return { success: false, error: "Unauthorized." };

  const applicantUser = await prisma.user.findFirst({
    where: { id: userId, role: "APPLICANT", isActive: true },
    select: { id: true, name: true, email: true, applicant: { select: { id: true, applicationNo: true, applyingForClass: true } } },
  });
  if (!applicantUser?.applicant) return { success: false, error: "Approved applicant not found." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.create({
    data: { userId: applicantUser.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
  });
  const setup = buildSetup(token, applicantUser);
  const delivery = await sendApplicantSetupEmail({
    to: setup.email, name: setup.name, setupUrl: setup.url,
    applicationNo: setup.applicationNo, applyingForClass: setup.applyingForClass,
    deliveryId: tokenHash,
  });
  if (!delivery.sent) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { success: false, error: delivery.error };
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: applicantUser.id, id: { not: record.id }, usedAt: null },
    data: { usedAt: new Date() },
  });
  await writeAuditLog({
    userId: session.user.id, action: "UPDATE", entity: "Applicant", entityId: applicantUser.applicant.id,
    description: `Applicant credentials emailed to ${applicantUser.email}`,
    newValue: { applicationNo: applicantUser.applicant.applicationNo, credentialsEmailed: true },
  });
  return { success: true, setup };
}
