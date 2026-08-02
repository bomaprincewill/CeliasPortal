import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, GraduationCap } from "lucide-react";

export default async function ParentReportsPage() {
  const session = await getSession();
  if (!session || session.user.role !== "PARENT") redirect("/auth/signin");

  const parent = await prisma.parent.findFirst({
    where: { userId: session.user.id },
    include: {
      children: {
        orderBy: { student: { firstName: "asc" } },
        include: {
          student: {
            include: { class: { select: { name: true, arm: true } } },
          },
        },
      },
    },
  });

  if (parent?.children.length === 1) {
    redirect(`/parent/report/${parent.children[0].studentId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Report Cards</h1>
        <p className="page-subtitle">Select a child to view their academic report.</p>
      </div>

      {!parent || parent.children.length === 0 ? (
        <div className="card card-body py-14 text-center text-muted">
          <GraduationCap className="mx-auto mb-3 h-11 w-11 text-slate-200" />
          <p>No children are linked to your account.</p>
          <p className="mt-1 text-xs">Contact the school administrator to link your child.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {parent.children.map(({ student }) => (
            <Link
              key={student.id}
              href={`/parent/report/${student.id}`}
              className="card card-body flex items-center gap-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink">{student.firstName} {student.lastName}</h2>
                <p className="mt-1 text-xs text-muted">
                  {student.studentId} · {student.class ? `${student.class.name} ${student.class.arm}` : "No class assigned"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
