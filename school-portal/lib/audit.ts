// lib/audit.ts
// ============================================================
// Audit log helper — wraps prisma.auditLog.create with typed
// parameters for consistent logging across all server actions.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/types";
import { headers } from "next/headers";
import { logger } from "@/lib/logger";

interface AuditParams {
  userId:      string | null;
  action:      AuditAction;
  entity:      string;
  entityId?:   string;
  description: string;
  oldValue?:   object;
  newValue?:   object;
  metadata?:   object;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    const headersList = await headers();
    const ip        = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;

    await prisma.auditLog.create({
      data: {
        userId:      params.userId,
        action:      params.action,
        entity:      params.entity,
        entityId:    params.entityId,
        description: params.description,
        oldValue:    params.oldValue    as never,
        newValue:    params.newValue    as never,
        metadata:    params.metadata   as never,
        ipAddress:   ip,
        userAgent,
      },
    });
  } catch (err) {
    // Audit log failures must NEVER break the main flow
    logger.error("audit.write_failed", err, { entity: params.entity, entityId: params.entityId, action: params.action });
  }
}

/** Fetch audit trail for a specific entity */
export async function getAuditTrail(entity: string, entityId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where:   { entity, entityId },
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });
}
