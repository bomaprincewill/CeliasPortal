"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type UpdateUserCredentialsInput = {
  userId: string;
  name: string;
  email: string;
  password?: string;
};

export async function updateUserCredentials(input: UpdateUserCredentialsInput) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Unauthorized." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim() ?? "";

  if (!input.userId) return { success: false, error: "Select a user to update." };
  if (!name) return { success: false, error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (password && password.length < 8) {
    return { success: false, error: "The new password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!existing) return { success: false, error: "User account not found." };

  const duplicate = await prisma.user.findFirst({
    where: { email, id: { not: input.userId } },
    select: { id: true },
  });
  if (duplicate) return { success: false, error: "A user with this email already exists." };

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      name,
      email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: updated.id,
    description: password ? `Password changed for ${updated.name}` : `Profile updated for ${updated.name}`,
    oldValue: { name: existing.name, email: existing.email, role: existing.role },
    newValue: { name: updated.name, email: updated.email, role: updated.role, passwordReset: Boolean(password) },
  });

  revalidatePath("/admin/users");

  return {
    success: true,
    user: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      ...(password ? { passwordSet: true, passwordChangedAt: new Date().toISOString() } : {}),
    },
  };
}
