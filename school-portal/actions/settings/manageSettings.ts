"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { GradeBandInput, validateGradeBands, validateScoreConfiguration } from "@/lib/settingsValidation";

const DEFAULT_GRADES: GradeBandInput[] = [
  { grade: "A", min: 75, max: 100, remark: "Distinction" },
  { grade: "B", min: 65, max: 74, remark: "Credit" },
  { grade: "C", min: 55, max: 64, remark: "Merit" },
  { grade: "D", min: 45, max: 54, remark: "Pass" },
  { grade: "E", min: 40, max: 44, remark: "Weak Pass" },
  { grade: "F", min: 0, max: 39, remark: "Fail" },
];

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) throw new Error("UNAUTHORIZED");
  return session;
}

export async function getSchoolSettings() {
  await requireAdmin();
  const [setting, sessions] = await Promise.all([
    prisma.schoolSetting.findUnique({ where: { id: "default" }, include: { gradeBands: { orderBy: { sortOrder: "asc" } } } }),
    prisma.academicSession.findMany({ orderBy: { startDate: "desc" } }),
  ]);
  return {
    school: setting ? { name: setting.name, address: setting.address, motto: setting.motto ?? "", phone: setting.phone ?? "", email: setting.email ?? "", website: setting.website ?? "" }
      : { name: "Model Primary & Secondary School", address: "14 Education Road, Lagos State, Nigeria", motto: "Excellence Through Knowledge", phone: "", email: "", website: "" },
    scoreConfig: setting ? { maxCA1: setting.maxCA1, maxCA2: setting.maxCA2, maxCA3: setting.maxCA3, maxExam: setting.maxExam } : { maxCA1: 10, maxCA2: 10, maxCA3: 10, maxExam: 70 },
    grading: setting?.gradeBands.length ? setting.gradeBands.map(b => ({ grade: b.grade, min: b.minScore, max: b.maxScore, remark: b.remark })) : DEFAULT_GRADES,
    sessions: sessions.map(s => ({ id: s.id, name: s.name, isCurrent: s.isCurrent })),
  };
}

export async function saveSchoolSettings(input: {
  school: { name: string; address: string; motto: string; phone: string; email: string; website: string };
  scoreConfig: { maxCA1: number; maxCA2: number; maxCA3: number; maxExam: number };
  grading: GradeBandInput[];
  sessions: { id: string; name: string; isCurrent: boolean }[];
}) {
  const session = await requireAdmin();
  const name = input.school.name.trim();
  const address = input.school.address.trim();
  if (!name || !address) return { success: false, error: "School name and address are required." };
  const scoreError = validateScoreConfiguration(input.scoreConfig);
  if (scoreError) return { success: false, error: scoreError };
  const gradeError = validateGradeBands(input.grading);
  if (gradeError) return { success: false, error: gradeError };
  if (!input.sessions.length || input.sessions.some(s => !/^\d{4}\/\d{4}$/.test(s.name.trim()))) return { success: false, error: "Use YYYY/YYYY for every academic session." };
  if (input.sessions.filter(s => s.isCurrent).length !== 1) return { success: false, error: "Select exactly one current academic session." };

  await prisma.$transaction(async tx => {
    await tx.schoolSetting.upsert({
      where: { id: "default" },
      update: { ...input.school, ...input.scoreConfig },
      create: { id: "default", ...input.school, ...input.scoreConfig },
    });
    await tx.gradeBand.deleteMany({ where: { settingId: "default" } });
    await tx.gradeBand.createMany({ data: input.grading.map((band, sortOrder) => ({ settingId: "default", grade: band.grade.trim().toUpperCase(), minScore: band.min, maxScore: band.max, remark: band.remark.trim(), sortOrder })) });
    await tx.academicSession.updateMany({ data: { isCurrent: false } });
    for (const item of input.sessions) {
      const startYear = Number(item.name.slice(0, 4));
      const data = { name: item.name.trim(), isCurrent: item.isCurrent, startDate: new Date(Date.UTC(startYear, 7, 1)), endDate: new Date(Date.UTC(startYear + 1, 6, 31)) };
      if (item.id.startsWith("new_")) await tx.academicSession.create({ data });
      else await tx.academicSession.update({ where: { id: item.id }, data });
    }
  });

  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "SchoolSetting", entityId: "default", description: "Updated school, grading, score, and academic-session settings" });
  revalidatePath("/admin/settings");
  return { success: true };
}
