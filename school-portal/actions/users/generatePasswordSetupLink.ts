"use server";

import { createHash, randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function generatePasswordSetupLink(userId: string) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return { success: false as const, error: "Unauthorized." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user) return { success: false as const, error: "User account not found." };
  if (!user.isActive) return { success: false as const, error: "Activate this account before generating a setup link." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } }),
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    description: `One-time password setup link generated for ${user.name}`,
  });

  const baseUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    success: true as const,
    setup: { name: user.name, email: user.email, url: `${baseUrl}/auth/reset-password/${encodeURIComponent(token)}` },
  };
}
