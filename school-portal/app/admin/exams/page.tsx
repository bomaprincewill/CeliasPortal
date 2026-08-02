import { getSession } from "@/lib/auth";
import { getLeadershipLevel, isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function AdminExamsPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.user.role)) redirect("/auth/signin");
  if (session.user.role === "NURSERY_HEAD") redirect("/admin/dashboard");
  const level = getLeadershipLevel(session.user.role);

  const exams = await prisma.exam.findMany({
    where: level ? { class: { level: { equals: level, mode: "insensitive" } } } : undefined,
    orderBy: { scheduledStart: "desc" },
    include: {
      class: { select: { name: true, arm: true } },
      _count: { select: { questions: true, submissions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Exams / CBT</h1>
        <p className="mt-1 text-sm text-muted">View scheduled examinations and submission activity.</p>
      </div>
      {exams.length === 0 ? (
        <div className="card card-body py-12 text-center text-muted">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          No CBT exams have been created yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <div key={exam.id} className="card card-body">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-ink">{exam.title}</h2>
                <span className={exam.isPublished ? "badge-green" : "badge-gray"}>
                  {exam.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {exam.type === "ENTRANCE" ? "Entrance exam" : `${exam.class?.name ?? "Unassigned"} ${exam.class?.arm ?? ""}`.trim()}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
                <span>{exam._count.questions} questions</span>
                <span>{exam._count.submissions} submissions</span>
                <span>{exam.durationMinutes} minutes</span>
              </div>
              <p className="mt-3 text-xs text-muted">
                {exam.scheduledStart.toLocaleString()} – {exam.scheduledEnd.toLocaleString()}
              </p>
              <Link href={`/admin/exams/${exam.id}`} className="btn-secondary btn-sm mt-4 w-full justify-center">
                View results
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
