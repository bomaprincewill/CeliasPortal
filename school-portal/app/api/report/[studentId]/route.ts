import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reuse the React-rendered report so printable and on-screen reports use the
// same historical enrollment, school settings, and escaped text content.
export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "PARENT") return new NextResponse("Forbidden", { status: 403 });
  const { studentId } = await params;
  const term = request.nextUrl.searchParams.get("term") ?? "FIRST";
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!["FIRST", "SECOND", "THIRD"].includes(term) || !sessionId) return new NextResponse("Invalid report selection", { status: 400 });
  const link = await prisma.parentStudent.findFirst({ where: { studentId, parent: { userId: session.user.id } }, select: { id: true } });
  if (!link) return new NextResponse("Forbidden", { status: 403 });
  const url = new URL(`/parent/report/${encodeURIComponent(studentId)}`, request.url);
  url.searchParams.set("term", term);
  url.searchParams.set("sessionId", sessionId);
  return NextResponse.redirect(url);
}
