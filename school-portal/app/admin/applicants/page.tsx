import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ApplicantAccountsClient from "./ApplicantAccountsClient";
import { sortClasses } from "@/lib/classSorting";

export default async function ApplicantAccountsPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/admin/dashboard");

  const [applicants, classes, academicSessions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "APPLICANT" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, isActive: true,
        applicant: { select: { applicationNo: true, applyingForClass: true, status: true } },
      },
    }),
    prisma.class.findMany({
      distinct: ["name"],
      orderBy: { name: "asc" },
      select: { id: true, name: true, arm: true, sessionId: true },
    }),
    prisma.academicSession.findMany({
      orderBy: { startDate: "desc" },
      select: { name: true },
    }),
  ]);

  return (
    <ApplicantAccountsClient
      initialApplicants={applicants}
      classNames={sortClasses(classes).map((item) => item.name)}
      enrollmentClasses={sortClasses(classes).map((item) => ({ id: item.id, label: `${item.name} ${item.arm}` }))}
      sessionNames={academicSessions.map((item) => item.name)}
    />
  );
}
