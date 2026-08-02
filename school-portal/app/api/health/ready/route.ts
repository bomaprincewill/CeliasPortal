import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export async function GET() {
  const startedAt = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database readiness check timed out")), 5_000)),
    ]);
    return NextResponse.json({ status: "ready", database: "reachable", latencyMs: Date.now() - startedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("health.readiness_failed", error, { latencyMs: Date.now() - startedAt });
    return NextResponse.json({ status: "not_ready", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
  }
}
