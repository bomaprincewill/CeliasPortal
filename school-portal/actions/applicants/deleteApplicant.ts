"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function deleteApplicant(userId: string) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Unauthorized." };
  }
  if (!userId) return { success: false, error: "Select an applicant to remove." };

  const applicantUser = await prisma.user.findFirst({
    where: { id: userId, role: "APPLICANT" },
    select: {
      id: true,
      name: true,
      email: true,
      applicant: { select: { id: true, applicationNo: true } },
    },
  });
  if (!applicantUser?.applicant) return { success: false, error: "Applicant not found." };

  await prisma.$transaction(async tx => {
    await tx.cBTSubmission.deleteMany({ where: { applicantId: applicantUser.applicant!.id } });
    await tx.user.delete({ where: { id: applicantUser.id } });
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entity: "Applicant",
    entityId: applicantUser.applicant.id,
    description: `Applicant ${applicantUser.name} (${applicantUser.applicant.applicationNo}) removed`,
    oldValue: { email: applicantUser.email, applicationNo: applicantUser.applicant.applicationNo },
  });

  revalidatePath("/admin/applicants");
  return { success: true };
}
