"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { sendApplicantCredentialsEmail } from "@/lib/email";
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

  const password = `App!${randomBytes(9).toString("base64url")}`;
  await prisma.user.update({ where: { id: applicantUser.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });

  const delivery = await sendApplicantCredentialsEmail({
    to: applicantUser.email, name: applicantUser.name, password,
    applicationNo: applicantUser.applicant.applicationNo,
    applyingForClass: applicantUser.applicant.applyingForClass,
  });
  if (!delivery.sent) return { success: false, error: delivery.error ?? "Credentials could not be emailed. The applicant remains pending approval." };

  await prisma.user.update({ where: { id: applicantUser.id }, data: { isActive: true } });
  await writeAuditLog({
    userId: session.user.id, action: "APPROVE", entity: "Applicant", entityId: applicantUser.applicant.id,
    description: `Applicant account approved and credentials sent to ${applicantUser.email}`,
    newValue: { applicationNo: applicantUser.applicant.applicationNo, credentialsSent: true },
  });
  revalidatePath("/admin/applicants");
  return { success: true };
}
