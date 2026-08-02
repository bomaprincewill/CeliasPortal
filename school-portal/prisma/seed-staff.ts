import type { PrismaClient, Role } from "@prisma/client";
import { abbreviateSubjectName } from "../lib/subjectCode";

type Job = { subjects: string[]; classes: string[] };
type Staff = { id: string; name: string; role: Role; form?: string; jobs: Job[] };

export async function seedStaff(prisma: PrismaClient, sessionId: string, passwordHash: string) {
  const extraClasses = [
    ["cls_rainbow_e","Rainbow","E","nursery"],["cls_rainbow_f","Rainbow","F","nursery"],
    ["cls_year_2_pearl","Year 2","Pearl","primary"],["cls_year_2_ruby","Year 2","Ruby","primary"],
    ["cls_year_4_pearl","Year 4","Pearl","primary"],["cls_year_4_ruby","Year 4","Ruby","primary"],
    ["cls_year_5_pearl","Year 5","Pearl","primary"],["cls_year_5_ruby","Year 5","Ruby","primary"],
  ] as const;
  for (const [id,name,arm,level] of extraClasses) {
    await prisma.class.upsert({
      where:{ id }, update:{ name,arm,level,sessionId },
      create:{ id,name,arm,level,sessionId },
    });
  }

  const C = {
    angel:["cls_angel_creche"], rainbowE:["cls_rainbow_e"], rainbowF:["cls_rainbow_f"],
    glorious:["cls_glorious_star"], bright:["cls_bright_star"], lavender:["cls_lavender"],
    y1:["cls_year_1"], y2p:["cls_year_2_pearl"], y2r:["cls_year_2_ruby"], y3:["cls_year_3"],
    y4:["cls_year_4"], y4p:["cls_year_4_pearl"], y4r:["cls_year_4_ruby"],
    y5:["cls_year_5"], y5p:["cls_year_5_pearl"], y5r:["cls_year_5_ruby"], y6:["cls_year_6"],
    j1:["cls_year_7"], j2:["cls_year_8"], j3:["cls_year_9"],
    s1:["cls_year_10"], s2:["cls_year_11"], s3:["cls_year_12"],
  };
  const junior=[...C.j1,...C.j2,...C.j3], senior=[...C.s1,...C.s2,...C.s3], high=[...junior,...senior];
  const primary=[...C.y2p,...C.y2r,...C.y3,...C.y4,...C.y4p,...C.y4r,...C.y5,...C.y5p,...C.y5r,...C.y6];
  const j=(subjects:string[],classes:string[]):Job=>({subjects,classes});
  const staff: Staff[] = [
    {id:"101",name:"Prevail Joseph",role:"NURSERY_HEAD",jobs:[j(["Public Speaking","Diction"],C.j2)]},
    {id:"102",name:"Chidinma Solomon",role:"FORM_TEACHER",form:C.angel[0],jobs:[j(["Scribbling and Pattern","Drawing and Identification of Objects","Sounds Identification","Colouring Activities"],C.angel)]},
    {id:"103",name:"Esther Emmanuel",role:"FORM_TEACHER",form:C.rainbowE[0],jobs:[j(["Letter Activities","Number Works Learning","Counting and Reasoning"],C.rainbowE)]},
    {id:"104",name:"Felicia Tabai",role:"FORM_TEACHER",form:C.rainbowF[0],jobs:[j(["Letter Activities","Number Works Learning","Counting and Reasoning"],C.rainbowF)]},
    {id:"105",name:"Victoria Mgbaja",role:"FORM_TEACHER",form:C.glorious[0],jobs:[j(["Literacy Thinking","Number Works Learning","Handwritings","English Mastering"],C.glorious)]},
    {id:"106",name:"Ann Innocent",role:"FORM_TEACHER",form:C.bright[0],jobs:[j(["Verbal","Quantitative Reasoning","English Mastering","Computer Science","Number Works (Maths)"],C.bright)]},
    {id:"107",name:"Lovina Michael",role:"FORM_TEACHER",form:C.lavender[0],jobs:[j(["English Language","Mental Maths","Vocational Aptitude","General Science","Computer Science","Maths"],C.lavender)]},
    {id:"108",name:"Sam Aniekan",role:"PRIMARY_HEAD",jobs:[j(["Maths","Quantitative Reasoning"],[...C.y4,...C.y5])]},
    {id:"109",name:"Chidera Divine Ndubuisi",role:"FORM_TEACHER",form:C.y1[0],jobs:[j(["English","Maths","General Science","RNV","Pre-Vocational Studies","Phonics","Vocational Aptitude","Home Economics"],C.y1)]},
    {id:"110",name:"Justina Olekanma",role:"FORM_TEACHER",form:C.y2p[0],jobs:[j(["English","Verbal Reasoning","RNV","Pre-Vocational Studies (Home Economics)","Phonics"],C.y2p)]},
    {id:"111",name:"Blessing Umoren",role:"FORM_TEACHER",form:C.y2r[0],jobs:[j(["Maths","Quantitative Reasoning","Basic Science","Vocational Aptitude","Pre-Vocational Studies (Agriculture)"],C.y2r)]},
    {id:"112",name:"Onyinye Nwoke",role:"FORM_TEACHER",form:C.y4p[0],jobs:[j(["English","Verbal Reasoning","RNV","Pre-Vocational Studies (Home Economics)","Vocational Aptitude"],C.y4p)]},
    {id:"113",name:"Husberth Osumili",role:"FORM_TEACHER",form:C.y4r[0],jobs:[j(["Maths","Quantitative Reasoning","Basic Science","Pre-Vocational Studies (Agriculture)"],C.y4r)]},
    {id:"114",name:"Prisca Anyanwu",role:"FORM_TEACHER",form:C.y5r[0],jobs:[j(["English","Verbal Reasoning","RNV","Pre-Vocational Studies (Home Economics)"],C.y5r)]},
    {id:"115",name:"Holy Pueba",role:"SUBJECT_TEACHER",jobs:[j(["Maths","PHE"],primary)]},
    {id:"116",name:"Victor Imonhi",role:"PRINCIPAL",jobs:[j(["Maths"],C.j1)]},
    {id:"117",name:"Lady C. Obiorah",role:"SUBJECT_TEACHER",jobs:[j(["English","Diction"],[...C.j1,...C.j3,...C.s3])]},
    {id:"118",name:"Ugochi Ama",role:"SUBJECT_TEACHER",jobs:[j(["Chemistry","Physics"],senior)]},
    {id:"119",name:"Susan Godwin",role:"SUBJECT_TEACHER",jobs:[j(["Biology","Basic Science"],high)]},
    {id:"120",name:"Grace",role:"SUBJECT_TEACHER",jobs:[j(["CRS"],high)]},
    {id:"121",name:"Jerry Njienue",role:"SUBJECT_TEACHER",jobs:[j(["Maths","Agricultural Science"],high)]},
    {id:"122",name:"Casmir Nwaozuzu",role:"SUBJECT_TEACHER",jobs:[j(["Digital Tech","PHE"],[...C.lavender,...C.y1,...C.y2p,...C.y2r,...C.y3,...high]),j(["Commerce"],high)]},
    {id:"123",name:"Mercy Donatus",role:"SUBJECT_TEACHER",jobs:[j(["English","Diction"],[...C.j2,...C.s1,...C.s2])]},
    {id:"124",name:"Kate Ikiriko",role:"SUBJECT_TEACHER",jobs:[j(["Business Studies","Accounting","Economics"],senior)]},
    {id:"125",name:"Reuben Anekwe",role:"SUBJECT_TEACHER",jobs:[j(["Basic Tech","Technical Drawing","Digital Tech"],high)]},
    {id:"126",name:"Ifeoma Ekene",role:"SUBJECT_TEACHER",jobs:[j(["History","Civic Education"],junior),j(["Government"],C.s3)]},
    {id:"127",name:"Manjor Douglas",role:"SUBJECT_TEACHER",jobs:[j(["Civic Education","Geography","Social Studies"],high)]},
    {id:"128",name:"Marcus Caleb",role:"SUBJECT_TEACHER",jobs:[j(["Music"],[...C.lavender,...junior])]},
    {id:"129",name:"Dickson Monday",role:"SUBJECT_TEACHER",jobs:[j(["Further Maths","Maths"],senior)]},
    {id:"130",name:"Tam Ibim",role:"SUBJECT_TEACHER",jobs:[j(["Data Processing","ICT"],high)]},
    {id:"131",name:"Goodluck Nwinee",role:"SUBJECT_TEACHER",jobs:[j(["French"],[...C.lavender,...junior])]},
    {id:"132",name:"Victoria Chukwu",role:"SUBJECT_TEACHER",jobs:[j(["Basic Science","Agricultural Science"],junior)]},
    {id:"133",name:"Christiana Nwabueze",role:"SUBJECT_TEACHER",jobs:[j(["Home Economics","Food and Nutrition"],junior)]},
  ];

  for (const item of staff) {
    const email=`${item.name.toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")}@school.edu`;
    const user=await prisma.user.upsert({
      where:{email},update:{name:item.name,role:item.role,isActive:true},
      create:{email,name:item.name,role:item.role,isActive:true,passwordHash},
    });
    const teacher=await prisma.teacher.upsert({
      where:{employeeId:`TCH${item.id}`},
      update:{userId:user.id,formClassId:item.form??null},
      create:{employeeId:`TCH${item.id}`,userId:user.id,formClassId:item.form},
    });
    await prisma.subjectAssignment.deleteMany({where:{teacherId:teacher.id}});
    for(const job of item.jobs) for(const name of job.subjects) {
      let subject=await prisma.subject.findFirst({where:{name}});
      if(!subject) {
        const baseCode=abbreviateSubjectName(name);
        let code=baseCode;
        let suffix=2;
        while(await prisma.subject.findUnique({where:{code}})) code=`${baseCode.slice(0,4)}${suffix++}`;
        subject=await prisma.subject.create({data:{code,name,isActive:true}});
      } else if (subject.code.startsWith("STAFF_") || subject.code.startsWith("SUB")) {
        const baseCode=abbreviateSubjectName(name);
        let code=baseCode;
        let suffix=2;
        let codeOwner=await prisma.subject.findUnique({where:{code}});
        while(codeOwner && codeOwner.id !== subject.id) {
          code=`${baseCode.slice(0,4)}${suffix++}`;
          codeOwner=await prisma.subject.findUnique({where:{code}});
        }
        subject=await prisma.subject.update({where:{id:subject.id},data:{code,isActive:true}});
      }
      for(const classId of job.classes) await prisma.subjectAssignment.create({
        data:{teacherId:teacher.id,subjectId:subject.id,classId,sessionId},
      });
    }
  }
}
