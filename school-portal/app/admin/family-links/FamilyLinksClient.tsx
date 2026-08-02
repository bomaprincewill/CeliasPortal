"use client";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { saveFamilyLinks } from "@/actions/parents/manageFamilyLinks";
import { Toast } from "@/components/ui";

type Parent = { id:string; user:{name:string;email:string}; children:{studentId:string;isPrimary:boolean}[] };
type Student = { id:string;studentId:string;firstName:string;lastName:string;class?:{name:string;arm:string}|null };
export default function FamilyLinksClient({parents,students}:{parents:Parent[];students:Student[]}) {
  const [parentId,setParentId]=useState(parents[0]?.id??""); const parent=useMemo(()=>parents.find(item=>item.id===parentId),[parents,parentId]);
  const [links,setLinks]=useState<string[]>(parent?.children.map(item=>item.studentId)??[]); const [primary,setPrimary]=useState(parent?.children.find(item=>item.isPrimary)?.studentId??"");
  const [toast,setToast]=useState<any>(null); const [pending,start]=useTransition();
  const choose=(id:string)=>{setParentId(id);const item=parents.find(p=>p.id===id);setLinks(item?.children.map(c=>c.studentId)??[]);setPrimary(item?.children.find(c=>c.isPrimary)?.studentId??"");};
  const save=()=>start(async()=>{const result=await saveFamilyLinks(parentId,links,primary||undefined);setToast(result.success?{type:"success",message:"Family links saved."}:{type:"error",message:result.error??"Links could not be saved."});});
  return <div className="space-y-6">{toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}<div><h1 className="page-title">Family Links</h1><p className="page-subtitle">Control which student records each parent can access.</p></div>
    <div className="card card-body"><label className="label">Parent account</label><select className="input mt-1" value={parentId} onChange={e=>choose(e.target.value)}>{parents.map(item=><option key={item.id} value={item.id}>{item.user.name} · {item.user.email}</option>)}</select></div>
    {!parents.length?<div className="card card-body text-center text-muted"><Users className="mx-auto h-8 w-8"/>No parent accounts are available.</div>:<div className="table-container"><table className="data-table"><thead><tr><th>Linked</th><th>Student</th><th>Class</th><th>Primary child</th></tr></thead><tbody>{students.map(student=>{const linked=links.includes(student.id);return <tr key={student.id}><td><input type="checkbox" checked={linked} onChange={()=>{setLinks(current=>linked?current.filter(id=>id!==student.id):[...current,student.id]);if(linked&&primary===student.id)setPrimary("");}}/></td><td><div className="font-medium">{student.lastName}, {student.firstName}</div><div className="text-xs text-muted font-mono">{student.studentId}</div></td><td>{student.class?`${student.class.name} ${student.class.arm}`:"—"}</td><td><input type="radio" name="primary" disabled={!linked} checked={primary===student.id} onChange={()=>setPrimary(student.id)}/></td></tr>})}</tbody></table></div>}
    <button disabled={pending||!parentId} onClick={save} className="btn-primary gap-2">{pending?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Save links</button>
  </div>;
}
