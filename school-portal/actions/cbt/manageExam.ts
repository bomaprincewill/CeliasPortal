"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { validateExamControls, validateManualMark } from "@/lib/cbtValidation";

async function requireExamManager(examId:string) {
  const session=await getSession(); if(!session) throw new Error("UNAUTHORIZED");
  const exam=await prisma.exam.findUnique({where:{id:examId}}); if(!exam) throw new Error("NOT_FOUND");
  const admin=["SUPER_ADMIN","ADMIN","PRIMARY_HEAD","PRINCIPAL"].includes(session.user.role);
  if(!admin && exam.createdById!==session.user.id) throw new Error("FORBIDDEN"); return {session,exam};
}

export async function updateExamControls(input:{examId:string;title:string;durationMinutes:number;passMark:number;maxAttempts:number;isPublished:boolean;showResultImmediately:boolean}) {
  const {session,exam}=await requireExamManager(input.examId); const error=validateExamControls(input); if(error)return{success:false,error}; if(!input.title.trim())return{success:false,error:"Exam title is required."};
  if(input.isPublished){const questionCount=await prisma.question.count({where:{examId:input.examId}});if(!questionCount)return{success:false,error:"Add questions before publishing."};}
  await prisma.exam.update({where:{id:input.examId},data:{title:input.title.trim(),durationMinutes:input.durationMinutes,passMark:Math.round(input.passMark),maxAttempts:input.maxAttempts,isPublished:input.isPublished,showResultImmediately:input.showResultImmediately}});
  await writeAuditLog({userId:session.user.id,action:"UPDATE",entity:"Exam",entityId:input.examId,description:`Updated CBT exam settings for ${input.title}`,oldValue:{isPublished:exam.isPublished,maxAttempts:exam.maxAttempts},newValue:input}); revalidatePath(`/admin/exams/${input.examId}`);revalidatePath("/admin/exams");revalidatePath("/teacher/exams");return{success:true};
}

export async function gradeWrittenAnswer(input:{submissionId:string;answerId:string;marks:number;feedback:string}) {
  const submission=await prisma.cBTSubmission.findUnique({where:{id:input.submissionId},include:{exam:true}});if(!submission)return{success:false,error:"Submission not found."};
  const {session}=await requireExamManager(submission.examId);
  const answer=await prisma.cBTAnswer.findFirst({where:{id:input.answerId,submissionId:input.submissionId},include:{question:true}});if(!answer||!["ESSAY","SHORT_ANSWER"].includes(answer.question.type))return{success:false,error:"Written answer not found."};
  const error=validateManualMark(input.marks,answer.question.marks);if(error)return{success:false,error};
  const result=await prisma.$transaction(async tx=>{
    await tx.cBTAnswer.update({where:{id:answer.id},data:{marksAwarded:input.marks,isCorrect:input.marks>=answer.question.marks*0.6,feedback:input.feedback.trim()||null,gradedAt:new Date(),gradedById:session.user.id}});
    const answers=await tx.cBTAnswer.findMany({where:{submissionId:input.submissionId},include:{question:{select:{type:true,marks:true}}}});
    const pending=answers.some(item=>["ESSAY","SHORT_ANSWER"].includes(item.question.type)&&!item.gradedAt&&item.isCorrect===null);
    const rawScore=answers.reduce((sum,item)=>sum+item.marksAwarded,0);const totalMarks=answers.reduce((sum,item)=>sum+item.question.marks,0);const percentage=totalMarks?Math.round(rawScore/totalMarks*100):0;const passed=percentage>=submission.exam.passMark;
    const updated=await tx.cBTSubmission.update({where:{id:input.submissionId},data:{rawScore,totalMarks,percentage,isPassed:pending?null:passed,gradingStatus:pending?"PENDING_MANUAL":"FINALIZED",finalizedAt:pending?null:new Date(),finalizedById:pending?null:session.user.id}});
    if(!pending&&updated.applicantId)await tx.applicant.update({where:{id:updated.applicantId},data:{admissionScore:rawScore}});return{pending,percentage};
  });
  await writeAuditLog({userId:session.user.id,action:"UPDATE",entity:"CBTAnswer",entityId:answer.id,description:`Manually graded written answer (${input.marks}/${answer.question.marks})`,newValue:{marks:input.marks,feedback:input.feedback}});revalidatePath(`/admin/exams/${submission.examId}`);revalidatePath(`/admin/exams/${submission.examId}/submissions/${submission.id}`);return{success:true,...result};
}
