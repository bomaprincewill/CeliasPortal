"use server";

import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session) return { success: false as const, error: "You must be signed in." };
  if (!currentPassword) return { success: false as const, error: "Enter your current password." };
  if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { success: false as const, error: "Use at least 12 characters with uppercase, lowercase, and a number." };
  }
  if (currentPassword === newPassword) return { success: false as const, error: "Choose a password different from your current password." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, passwordHash: true } });
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { success: false as const, error: "Your current password is incorrect." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authThrottle.deleteMany({ where: { identifier: user.email } }),
  ]);
  await writeAuditLog({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, description: "Password changed by account owner" });
  return { success: true as const };
}
