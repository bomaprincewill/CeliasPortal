"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

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
  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const setupUrl = `${baseUrl}/auth/reset-password/${encodeURIComponent(token)}`;
  await writeAuditLog({
    userId: session.user.id, action: "APPROVE", entity: "Applicant", entityId: applicantUser.applicant.id,
    description: `Applicant account approved and a one-time setup link generated`,
    newValue: { applicationNo: applicantUser.applicant.applicationNo, setupLinkGenerated: true },
  });
  revalidatePath("/admin/applicants");
  return {
    success: true,
    setup: { url: setupUrl, name: applicantUser.name, applicationNo: applicantUser.applicant.applicationNo },
  };
}
