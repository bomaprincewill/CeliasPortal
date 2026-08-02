import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/studentAccess";
import ReportCard from "@/components/results/ReportCard";
import PrintButton from "@/components/results/PrintButton";
import type { Term } from "@/types";

export default async function StudentReportPage({ searchParams }: { searchParams: Promise<{ sessionId?: string; term?: string }> }) {
  let student; try { ({ student } = await requireStudentProfile()); } catch { redirect("/auth/signin"); }
  const query = await searchParams;
  const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  const sessionId = query.sessionId ?? currentSession?.id;
  const term = (query.term ?? "FIRST") as Term;
  if (!sessionId || !["FIRST", "SECOND", "THIRD"].includes(term)) notFound();
  const [academicSession, enrollment, results, summary, attendance, comments, school] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: sessionId } }),
    prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: student.id, sessionId } }, include: { class: { select: { name: true, arm: true } } } }),
    prisma.result.findMany({ where: { studentId: student.id, sessionId, term, status: { in: ["APPROVED", "LOCKED"] } }, include: { subject: true }, orderBy: { subject: { name: "asc" } } }),
    prisma.broadSheet.findFirst({ where: { studentId: student.id, sessionId, term } }),
    prisma.attendance.groupBy({ by: ["status"], where: { studentId: student.id, sessionId, term }, _count: { status: true } }),
    prisma.resultComment.findMany({ where: { studentId: student.id, sessionId, term } }),
    prisma.schoolSetting.findUnique({ where: { id: "default" } }),
  ]);
  if (!academicSession || !enrollment) notFound();
  const count = (status: string) => attendance.find(item => item.status === status)?._count.status ?? 0;
  return <div className="space-y-5"><div className="no-print flex items-center justify-between"><Link href="/student/history" className="text-sm text-brand-600 hover:underline">← Academic history</Link><PrintButton/></div>
    {!results.length && <div className="card card-body text-center text-sm text-muted no-print">No approved results are available for this term.</div>}
    <ReportCard school={{ name: school?.name ?? "School Portal", address: school?.address ?? "", motto: school?.motto ?? undefined }} student={{ name: `${student.firstName} ${student.middleName ? `${student.middleName} ` : ""}${student.lastName}`, studentId: student.studentId, className: `${enrollment.class.name} ${enrollment.class.arm}`, gender: student.gender, dateOfBirth: student.dateOfBirth.toLocaleDateString("en-NG"), photoUrl: student.photoUrl ?? undefined }} session={academicSession.name} term={term} results={results.map(item => ({ subjectName:item.subject.name, subjectCode:item.subject.code, ca1:item.ca1, ca2:item.ca2, ca3:item.ca3, examScore:item.examScore, total:item.total, grade:item.grade, remark:item.remark, position:item.position, maxCA1:item.maxCA1, maxCA2:item.maxCA2, maxCA3:item.maxCA3, maxExam:item.maxExam, maxTotal:item.maxTotal }))} summary={{ totalScore:summary?.totalScore ?? 0, averageScore:summary?.averageScore ?? 0, position:summary?.position ?? 0, outOf:summary?.outOf ?? 0, isLocked:summary?.isLocked ?? false }} formTeacherComment={comments.find(item => item.type === "FORM_TEACHER")?.comment} principalComment={comments.find(item => item.type === "PRINCIPAL")?.comment} attendance={{ present:count("PRESENT"), absent:count("ABSENT"), late:count("LATE"), total:attendance.reduce((sum,item)=>sum+item._count.status,0) }} isLocked={summary?.isLocked}/>
  </div>;
}
