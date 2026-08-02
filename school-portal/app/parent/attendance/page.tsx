import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TERM_LABELS, type Term } from "@/types";

export default async function ParentAttendancePage({searchParams}:{searchParams:Promise<{studentId?:string}>}) {
  const session=await getSession(); if(!session||session.user.role!=="PARENT")redirect("/auth/signin"); const {studentId}=await searchParams;
  const children=await prisma.parentStudent.findMany({where:{parent:{userId:session.user.id}},include:{student:true}}); const selected=studentId?children.find(item=>item.studentId===studentId):children[0]; if(!selected)notFound();
  const grouped=await prisma.attendance.groupBy({by:["sessionId","term","status"],where:{studentId:selected.studentId},_count:{status:true}}); const sessions=await prisma.academicSession.findMany({where:{id:{in:[...new Set(grouped.map(i=>i.sessionId))]}},select:{id:true,name:true}});const names=new Map(sessions.map(i=>[i.id,i.name]));const rows=new Map<string,Record<string,number>>();grouped.forEach(i=>{const k=`${i.sessionId}:${i.term}`;rows.set(k,{...(rows.get(k)??{}),[i.status]:i._count.status});});
  return <div className="space-y-6"><div><h1 className="page-title">Attendance — {selected.student.firstName} {selected.student.lastName}</h1><p className="page-subtitle">Attendance history by term.</p></div><div className="table-container"><table className="data-table"><thead><tr><th>Session</th><th>Term</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead><tbody>{[...rows].map(([key,c])=>{const [sid,t]=key.split(":");const total=Object.values(c).reduce((a,b)=>a+b,0);return <tr key={key}><td>{names.get(sid)}</td><td>{TERM_LABELS[t as Term]}</td><td>{c.PRESENT??0}</td><td>{c.ABSENT??0}</td><td>{c.LATE??0}</td><td>{total?Math.round((c.PRESENT??0)/total*100):0}%</td></tr>})}{!rows.size&&<tr><td colSpan={6} className="py-10 text-center text-muted">No attendance recorded.</td></tr>}</tbody></table></div></div>;
}
