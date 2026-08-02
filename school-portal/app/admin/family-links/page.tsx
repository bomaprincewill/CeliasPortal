import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FamilyLinksClient from "./FamilyLinksClient";

export default async function FamilyLinksPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN","ADMIN"].includes(session.user.role)) redirect("/auth/signin");
  const [parents, students] = await Promise.all([
    prisma.parent.findMany({ include:{ user:{ select:{ name:true,email:true } }, children:{ select:{ studentId:true,isPrimary:true } } }, orderBy:{ user:{ name:"asc" } } }),
    prisma.student.findMany({ where:{ status:"ACTIVE" }, include:{ class:{ select:{ name:true,arm:true } } }, orderBy:[{ lastName:"asc" },{ firstName:"asc" }] }),
  ]);
  return <FamilyLinksClient parents={parents as never} students={students as never}/>;
}
