import type { Role } from "@/types";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "NURSERY_HEAD",
  "PRIMARY_HEAD",
  "PRINCIPAL",
];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function getLeadershipLevel(role: Role): string | null {
  if (role === "NURSERY_HEAD") return "nursery";
  if (role === "PRIMARY_HEAD") return "primary";
  if (role === "PRINCIPAL") return "secondary";
  return null;
}

export async function assertClassAccess(role: Role, classId: string): Promise<void> {
  const level = getLeadershipLevel(role);
  if (!level) return;

  const schoolClass = await prisma.class.findFirst({
    where: { id: classId, level: { equals: level, mode: "insensitive" } },
    select: { id: true },
  });

  if (!schoolClass) throw new Error("FORBIDDEN");
}
