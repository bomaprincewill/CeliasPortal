import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ClipboardList, BookOpen } from "lucide-react";
import type { AdmissionStatus } from "@/types";

const STATUS_CONFIG: Record<AdmissionStatus, { label:string; color:string; icon: React.ElementType; desc:string }> = {
  PENDING:   { label:"Under Review",  color:"badge-yellow", icon:Clock,        desc:"Your application is being reviewed by the admissions team." },
  OFFERED:   { label:"Offer Made",    color:"badge-blue",   icon:CheckCircle2, desc:"Congratulations! You have been offered admission. Accept your offer below." },
  ACCEPTED:  { label:"Accepted",      color:"badge-green",  icon:CheckCircle2, desc:"You have accepted your admission offer. Await further instructions." },
  REJECTED:  { label:"Not Successful",color:"badge-red",    icon:XCircle,      desc:"Unfortunately your application was not successful this time." },
  WITHDRAWN: { label:"Withdrawn",     color:"badge-gray",   icon:AlertTriangle,desc:"Your application has been withdrawn." },
};

export default async function ApplicantDashboard() {
  const session = await getSession();
  if (!session || session.user.role !== "APPLICANT") redirect("/auth/signin");

  const applicant = await prisma.applicant.findFirst({
    where: { userId: session.user.id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!applicant) {
    return (
      <div className="card card-body py-12 text-center">
        <h1 className="text-lg font-semibold text-ink">Applicant profile not configured</h1>
        <p className="mt-1 text-sm text-muted">Contact the School Admin to generate your applicant account.</p>
      </div>
    );
  }

  // Find available entrance exams
  const slatedEntranceExam = await prisma.exam.findFirst({
    where: {
      type: "ENTRANCE",
      isPublished: true,
      scheduledStart: { lte: new Date() },
      scheduledEnd:   { gte: new Date() },
    },
    orderBy: { scheduledStart: "asc" },
    select: { id:true, title:true, durationMinutes:true, passMark:true, scheduledEnd:true, questions:{ select:{ id:true } } },
  });
  const entranceExams = slatedEntranceExam ? [slatedEntranceExam] : [];

  // Check which exams this applicant already sat
  const submissions = await prisma.cBTSubmission.findMany({
    where: { applicantId: applicant.id, submittedAt: { not: null } },
    select: { examId:true, percentage:true, isPassed:true, submittedAt:true },
  });
  const submittedExamIds = new Set(submissions.map(s => s.examId));

  const status     = applicant.status as AdmissionStatus;
  const statusCfg  = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome, {applicant.firstName} {applicant.lastName}
        </h1>
        <p className="text-muted text-sm mt-1">
          Application No: <span className="font-mono font-semibold text-ink">{applicant.applicationNo}</span>
          {" · "} Applying for: <strong>{applicant.applyingForClass}</strong>
          {" · "} Session: {applicant.academicSession}
        </p>
      </div>

      {/* Admission status card */}
      <div className={`card card-body border-2 ${status==="OFFERED"||status==="ACCEPTED"?"border-emerald-200 bg-emerald-50":status==="REJECTED"?"border-red-200 bg-red-50":"border-yellow-200 bg-yellow-50"}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${status==="OFFERED"||status==="ACCEPTED"?"bg-emerald-100":status==="REJECTED"?"bg-red-100":"bg-yellow-100"}`}>
            <StatusIcon className={`w-6 h-6 ${status==="OFFERED"||status==="ACCEPTED"?"text-emerald-600":status==="REJECTED"?"text-red-600":"text-yellow-600"}`}/>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-display font-bold text-lg text-ink">Admission Status</h2>
              <span className={statusCfg.color}>{statusCfg.label}</span>
            </div>
            <p className="text-sm text-muted">{statusCfg.desc}</p>
            {applicant.admissionScore !== null && (
              <p className="text-sm mt-2">
                Entrance Exam Score: <strong className="text-ink">{applicant.admissionScore?.toFixed(1)}</strong>
              </p>
            )}
            {status === "OFFERED" && (
              <div className="mt-4 flex gap-3">
                <button className="btn-success btn-sm">Accept Offer</button>
                <button className="btn-danger btn-sm">Decline Offer</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entrance exams */}
      <div className="space-y-3">
        <h2 className="font-semibold text-ink flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-600"/> Entrance Exams
        </h2>

        {entranceExams.length === 0 && (
          <div className="card card-body text-center py-8 text-muted text-sm">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
            No entrance exams are currently available.
          </div>
        )}

        {entranceExams.map(exam => {
          const sub        = submissions.find(s => s.examId === exam.id);
          const alreadySat = submittedExamIds.has(exam.id);
          const expiresAt  = new Date(exam.scheduledEnd);
          const timeLeft   = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000));

          return (
            <div key={exam.id} className="card card-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-ink">{exam.title}</h3>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
                  <span>{exam.questions.length} questions</span>
                  <span>{exam.durationMinutes} minutes</span>
                  <span>Pass: {exam.passMark}%</span>
                  {!alreadySat && <span className="text-warn">Closes in {timeLeft} min</span>}
                </div>
                {alreadySat && sub && (
                  <div className="mt-2 text-xs">
                    Score: <strong className={sub.isPassed?"text-emerald-600":"text-red-600"}>{sub.percentage}%</strong>
                    <span className={`ml-2 badge ${sub.isPassed?"badge-green":"badge-red"}`}>{sub.isPassed?"Passed":"Did not pass"}</span>
                  </div>
                )}
              </div>
              <div className="w-full shrink-0 sm:w-auto">
                {alreadySat ? (
                  <span className="badge-green">✓ Submitted</span>
                ) : (
                  <Link href={`/applicant/exam/${exam.id}`} className="btn-primary w-full justify-center sm:w-auto">
                    Start Exam →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info panel */}
      <div className="card card-body bg-brand-50 border-brand-100">
        <h3 className="font-semibold text-brand-800 text-sm mb-2">What happens next?</h3>
        <ol className="text-xs text-brand-700 space-y-1 list-decimal list-inside">
          <li>Sit for the entrance examination when it becomes available.</li>
          <li>The admissions team will review your score and application.</li>
          <li>You will be notified here if you receive an offer of admission.</li>
          <li>Accept your offer and pay the acceptance fee within the deadline.</li>
          <li>Receive your student ID and class assignment.</li>
        </ol>
      </div>
    </div>
  );
}
