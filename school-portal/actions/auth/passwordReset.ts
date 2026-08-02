"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";

const genericMessage = "If an active account matches that email, a reset link has been sent.";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid email address." };
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true } });
  if (!user?.isActive) return { success: true, message: genericMessage };

  const recent = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent) return { success: true, message: genericMessage };
  const token = randomBytes(32).toString("base64url");
  const record = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
  const delivery = await sendPasswordResetEmail({ to: user.email, name: user.name, token });
  if (!delivery.sent) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { success: false, error: delivery.error };
  }
  return { success: true, message: genericMessage };
}

export async function resetPassword(token: string, password: string) {
  if (!token || token.length < 32) return { success: false, error: "This reset link is invalid or expired." };
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return { success: false, error: "Use at least 12 characters with uppercase, lowercase, and a number." };
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return { success: false, error: "This reset link is invalid or expired." };
  const user = await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true } });
  if (!user) return { success: false, error: "This reset link is invalid or expired." };
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authThrottle.deleteMany({ where: { identifier: user.email } }),
  ]);
  await writeAuditLog({ userId: record.userId, action: "UPDATE", entity: "User", entityId: record.userId, description: "Password reset completed" });
  return { success: true };
}
