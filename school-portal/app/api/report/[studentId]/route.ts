import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Term } from "@/types";

/**
 * GET /api/report/[studentId]?term=FIRST&sessionId=xxx
 *
 * Generates a printable HTML page for the report card.
 * In production, pipe this through Puppeteer or @vercel/og for a true PDF.
 * For now: returns an HTML page that auto-triggers the print dialog.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "PARENT") return new NextResponse("Forbidden", { status: 403 });

  const { studentId } = await params;
  const { searchParams } = new URL(request.url);
  const term      = (searchParams.get("term") ?? "FIRST") as Term;
  const sessionId = searchParams.get("sessionId") ?? "";

  // Authorization: a parent can only access a pupil explicitly linked to their account.
  const link = await prisma.parentStudent.findFirst({
    where: { studentId, parent: { userId: session.user.id } },
    select: { id: true },
  });
  if (!link) return new NextResponse("Forbidden", { status: 403 });

  const [student, results, broadSheet] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { select: { name:true, arm:true } } },
    }),
    prisma.result.findMany({
      where: { studentId, sessionId, term, status: { in: ["APPROVED","LOCKED"] } },
      include: { subject: { select: { name:true, code:true } } },
    }),
    prisma.broadSheet.findFirst({ where: { studentId, sessionId, term } }),
  ]);

  if (!student) return new NextResponse("Student not found", { status: 404 });

  // Build printable HTML
  const rows = results.map(r => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${r.subject.name}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.ca1 ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.ca2 ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.ca3 ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.examScore ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;border-bottom:1px solid #e2e8f0">${r.total ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.grade ?? "—"}</td>
      <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0">${r.remark ?? "—"}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Report Card — ${student.firstName} ${student.lastName}</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; color: #0f172a; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #00572d; font-size: 22px; margin: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { background: #00572d; color: white; }
    thead th { padding: 8px 10px; text-align: center; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 13px; }
    .label { color: #64748b; font-size: 11px; }
    .summary { background: #00572d; color: white; padding: 10px; margin-top: 12px; border-radius: 6px; display: flex; justify-content: space-between; font-size: 13px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div style="text-align:center;border-bottom:3px solid #00572d;padding-bottom:16px;margin-bottom:20px">
    <h1>MODEL PRIMARY &amp; SECONDARY SCHOOL</h1>
    <p style="margin:4px 0;color:#64748b;font-size:13px">14 Education Road, Lagos State, Nigeria</p>
    <div style="background:#00572d;color:white;display:inline-block;padding:6px 20px;border-radius:20px;font-size:13px;font-weight:600;margin-top:8px">
      STUDENT REPORT CARD &mdash; ${term} TERM
    </div>
  </div>
  
  <div class="info-grid">
    <div><div class="label">Student Name</div><strong>${student.firstName} ${student.lastName}</strong></div>
    <div><div class="label">Student ID</div><strong>${student.studentId}</strong></div>
    <div><div class="label">Class</div><strong>${student.class?.name ?? ""} ${student.class?.arm ?? ""}</strong></div>
    <div><div class="label">Gender</div><strong>${student.gender}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;padding:8px 10px">Subject</th>
        <th>CA1</th><th>CA2</th><th>CA3</th><th>Exam</th>
        <th>Total</th><th>Grade</th><th>Remark</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${broadSheet ? `
  <div class="summary">
    <span>Total Score: <strong>${broadSheet.totalScore.toFixed(0)}</strong></span>
    <span>Average: <strong>${broadSheet.averageScore.toFixed(1)}%</strong></span>
    <span>Position: <strong>${broadSheet.position}${broadSheet.position===1?"st":broadSheet.position===2?"nd":"th"} / ${broadSheet.outOf}</strong></span>
    ${broadSheet.isLocked ? '<span>🔒 Official Result</span>' : ''}
  </div>` : ""}

  <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      <div style="color:#64748b;margin-bottom:8px;font-weight:600">Form Teacher's Comment</div>
      <div style="min-height:40px;font-style:italic">—</div>
      <div style="border-top:1px dashed #cbd5e1;margin-top:12px;padding-top:4px;color:#64748b">Signature</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      <div style="color:#64748b;margin-bottom:8px;font-weight:600">Principal's Comment</div>
      <div style="min-height:40px;font-style:italic">Keep up the good work!</div>
      <div style="border-top:1px dashed #cbd5e1;margin-top:12px;padding-top:4px;color:#64748b">Signature &amp; Stamp</div>
    </div>
  </div>

  <div style="border-top:2px solid #00572d;margin-top:24px;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
    <span>Generated: ${new Date().toLocaleDateString("en-NG", { day:"numeric", month:"long", year:"numeric" })}</span>
    <span>${student.studentId}</span>
  </div>

  <button onclick="window.print()" style="margin-top:16px;background:#00843d;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">
    🖨 Print / Save as PDF
  </button>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="report-${student.studentId}-${term}.html"`,
    },
  });
}
