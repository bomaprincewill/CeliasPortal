import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnrollmentClient from "./EnrollmentClient";
import { sortClasses } from "@/lib/classSorting";

export default async function EnrollmentsPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(session.user.role)) redirect("/admin/dashboard");
  const classes = await prisma.class.findMany({
    orderBy: [{ session: { startDate: "desc" } }, { name: "asc" }, { arm: "asc" }],
    include: {
      session: { select: { name: true } },
      students: {
        where: { status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
      _count: { select: { students: true } },
    },
  });
  return <EnrollmentClient classes={sortClasses(classes) as never} />;
}
