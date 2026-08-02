import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BroadSheet from "@/components/results/BroadSheet";
import type { Term } from "@/types";

export default async function BroadSheetPage({ searchParams }: { searchParams: Promise<{ term?: string; sessionId?: string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || !["FORM_TEACHER","SUPER_ADMIN"].includes(session.user.role)) redirect("/teacher/dashboard");

  const classId = session.user.formClassId;
  if (!classId && session.user.role !== "SUPER_ADMIN") {
    return <div className="p-8 text-muted">You are not assigned as a form teacher to any class.</div>;
  }

  const term      = (query.term ?? "FIRST") as Term;
  const currentSess = await prisma.academicSession.findFirst({ where:{ isCurrent:true } });
  const sessionId = query.sessionId ?? currentSess?.id ?? "";

  const [classRecord, subjects, results, broadSheetRows] = await Promise.all([
    prisma.class.findUnique({ where:{ id: classId! }, select:{ name:true, arm:true } }),
    prisma.subjectAssignment.findMany({
      where:{ classId: classId! },
      include:{ subject:{ select:{ id:true, name:true, code:true } } },
      distinct:["subjectId"],
    }),
    prisma.result.findMany({
      where:{ classId: classId!, sessionId, term, status:{ in:["SUBMITTED","APPROVED","LOCKED"] } },
      select:{ studentId:true, subjectId:true, total:true, grade:true, status:true },
    }),
    prisma.broadSheet.findMany({
      where:{ classId: classId!, sessionId, term },
      select:{ studentId:true, totalScore:true, averageScore:true, position:true, outOf:true, isLocked:true },
    }),
  ]);

  const students = await prisma.student.findMany({
    where:{ classId: classId!, isActive:true },
    orderBy:[{ lastName:"asc" },{ firstName:"asc" }],
    select:{ id:true, studentId:true, firstName:true, lastName:true },
  });

  if (!classRecord) return <div className="p-8 text-muted">Class not found.</div>;

  const subjectCols = subjects.map(a => a.subject);
  const bsMap       = new Map(broadSheetRows.map(b => [b.studentId, b]));
  const resultMap   = new Map<string, Map<string, { total:number; grade:string }>>();

  for (const r of results) {
    if (!resultMap.has(r.studentId)) resultMap.set(r.studentId, new Map());
    resultMap.get(r.studentId)!.set(r.subjectId, { total: r.total ?? 0, grade: r.grade ?? "F" });
  }

  const studentRows = students.map(s => {
    const bs     = bsMap.get(s.id);
    const scores: Record<string, { total:number; grade:string } | null> = {};
    for (const sub of subjectCols) {
      scores[sub.id] = resultMap.get(s.id)?.get(sub.id) ?? null;
    }
    return {
      studentId:  s.id, studentNo: s.studentId, name: `${s.lastName}, ${s.firstName}`,
      scores, cumulative: bs?.totalScore ?? 0, average: bs?.averageScore ?? 0,
      position: bs?.position ?? 0, outOf: bs?.outOf ?? students.length,
    };
  }).sort((a,b) => (a.position||999) - (b.position||999));

  const isLocked = broadSheetRows.some(b=>b.isLocked);

  return (
    <BroadSheet
      classId={classId!}
      className={`${classRecord.name} ${classRecord.arm}`}
      sessionName={currentSess?.name ?? sessionId}
      term={term}
      subjects={subjectCols}
      students={studentRows}
      isLocked={isLocked}
    />
  );
}
