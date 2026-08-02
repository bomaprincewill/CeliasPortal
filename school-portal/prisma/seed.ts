// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedStaff } from "./seed-staff";
import { cleanupDemoData } from "./cleanup-demo-data";
import { abbreviateSubjectName } from "../lib/subjectCode";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  if (process.env.NODE_ENV === "production") {
    throw new Error("The demonstration seed must not be run in production.");
  }
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error("Set SEED_DEFAULT_PASSWORD to a unique value of at least 12 characters before seeding.");
  }
  const pw = await bcrypt.hash(seedPassword, 12);

  // ── Academic Session ─────────────────────────────────────────
  const session = await prisma.academicSession.upsert({
    where:  { id: "sess_2025" },
    update: {},
    create: { id:"sess_2025", name:"2024/2025", isCurrent:true, startDate: new Date("2024-09-01"), endDate: new Date("2025-07-31") },
  });
  console.log("✓ Academic session");

  // ── Classes ───────────────────────────────────────────────────
  const classConfigs = [
    { id:"cls_angel_creche", name:"Angel/Creche", level:"nursery", subjects:["Scribbling and Pattern","Colouring Activities","Sounds Identification","Drawing and Identification of Objects"] },
    { id:"cls_rainbow", name:"Rainbow", level:"nursery", subjects:["Letter Activities","Counting and Reasoning","Number Works Learning"] },
    { id:"cls_glorious_star", name:"Glorious Star", level:"nursery", subjects:["Language Activities","Number Works Learning","Handwritings"] },
    { id:"cls_bright_star", name:"Bright Star", level:"nursery", subjects:["Verbal","Quantitative Reasoning","English Language/Comprehension","Number Works (Maths)","Word Formation","Digital Tech","Diction"] },
    { id:"cls_lavender", name:"Lavender", level:"nursery", subjects:["English","Maths","Verbal/Quantitative Reasoning","General Sc.","RNV","Vocational Aptitude","Home Economics","Computer","Diction","French"] },
    { id:"cls_year_1", name:"Year 1", level:"primary", subjects:["English","Maths","Verbal/Quantitative Reasoning","General Sc.","RNV","Vocational Aptitude","Home Economics","Computer","Diction","French"] },
    { id:"cls_year_3", name:"Year 3", level:"primary", subjects:["English","Maths","Verbal/Quantitative Reasoning","Basic Sc.","RNV","Vocational Aptitude","Pre-Vocational Studies","Computer","Diction","French","PHE"] },
    { id:"cls_year_4", name:"Year 4", level:"primary", subjects:["English","Maths","Verbal/Quantitative Reasoning","Basic Sc.","RNV","Vocational Aptitude","Pre-Vocational Studies","Computer","Diction","French","PHE"] },
    { id:"cls_year_5", name:"Year 5", level:"primary", subjects:["English","Maths","Verbal/Quantitative Reasoning","Basic Sc.","RNV","Vocational Aptitude","Pre-Vocational Studies","Computer","Diction","French","PHE"] },
    { id:"cls_year_6", name:"Year 6", level:"primary", subjects:["English","Maths","Verbal/Quantitative Reasoning","Basic Sc.","RNV","Vocational Aptitude","Pre-Vocational Studies","Computer","Diction","French","PHE"] },
    { id:"cls_year_7", name:"Year 7", level:"secondary", subjects:["English","Maths","Business Studies","Basic Tech","Social Studies","Agricultural Science","French","Home Economics","History","CCA","Public Speaking","Diction","Digital Tech","Civic Education","Basic Science"] },
    { id:"cls_year_8", name:"Year 8", level:"secondary", subjects:["English","Maths","Business Studies","Basic Tech","Social Studies","Agricultural Science","French","Home Economics","History","CCA","Public Speaking","Diction","Digital Tech","Civic Education","Basic Science"] },
    { id:"cls_year_9", name:"Year 9", level:"secondary", subjects:["English","Maths","Business Studies","Basic Tech","Social Studies","Agricultural Science","French","Home Economics","History","CCA","Public Speaking","Diction","Digital Tech","Civic Education","Basic Science"] },
    { id:"cls_year_10", name:"Year 10", level:"secondary", subjects:["English","Maths","Further Maths","Physics","Chemistry","Biology","Economics","Geography","Civic Education","Agricultural Science","Government","Literature","Data Processing","Marketing","Accounting","Technical Drawing"] },
    { id:"cls_year_11", name:"Year 11", level:"secondary", subjects:["English","Maths","Further Maths","Physics","Chemistry","Biology","Economics","Geography","Civic Education","Agricultural Science","Government","Literature","Data Processing","Marketing","Accounting","Technical Drawing"] },
    { id:"cls_year_12", name:"Year 12", level:"secondary", subjects:["English","Maths","Further Maths","Physics","Chemistry","Biology","Economics","Geography","Civic Education","Agricultural Science","Government","Literature","Data Processing","Marketing","Accounting","Technical Drawing"] },
  ] as const;
  const classes = new Map<string, Awaited<ReturnType<typeof prisma.class.upsert>>>();
  for (const config of classConfigs) {
    const schoolClass = await prisma.class.upsert({
      where:{ id:config.id },
      update:{ name:config.name, level:config.level, sessionId:session.id },
      create:{ id:config.id, name:config.name, arm:"A", level:config.level, sessionId:session.id },
    });
    classes.set(config.name, schoolClass);
  }
  const cls1 = classes.get("Year 4")!;

  // Remove legacy demo classes while retaining their students in Year 4.
  await prisma.result.deleteMany({
    where: { classId: { in: ["cls_p4a", "cls_jss1a"] } },
  });
  await prisma.student.updateMany({
    where: { classId: { in: ["cls_p4a", "cls_jss1a"] } },
    data: { classId: cls1.id },
  });
  await prisma.class.deleteMany({
    where: { id: { in: ["cls_p4a", "cls_jss1a"] } },
  });
  console.log("✓ Classes");

  // ── Subjects ──────────────────────────────────────────────────
  const subjectNames = [...new Set(classConfigs.flatMap(config => [...config.subjects]))];
  const subjects = new Map<string, Awaited<ReturnType<typeof prisma.subject.upsert>>>();
  const usedSubjectCodes = new Set<string>();
  for (const name of subjectNames) {
    const baseCode = abbreviateSubjectName(name);
    let code = baseCode;
    let suffix = 2;
    while (usedSubjectCodes.has(code)) code = `${baseCode.slice(0, 4)}${suffix++}`;
    usedSubjectCodes.add(code);

    const existingSubject = await prisma.subject.findFirst({ where:{ name } });
    const subject = existingSubject
      ? await prisma.subject.update({ where:{ id:existingSubject.id }, data:{ code, isActive:true } })
      : await prisma.subject.create({ data:{ code, name } });
    subjects.set(name, subject);
  }
  const maths = subjects.get("Maths")!;
  console.log("✓ Subjects");

  // ── Users & Roles ─────────────────────────────────────────────
  // Super Admin
  const adminUser = await prisma.user.upsert({
    where:  { email:"admin@school.edu" },
    update: {},
    create: { email:"admin@school.edu", name:"Admin User", passwordHash:pw, role:"SUPER_ADMIN", isActive:true },
  });

  // Finance
  await prisma.user.upsert({
    where:  { email:"finance@school.edu" },
    update: { name:"Finance Officer", role:"BURSAR_ACCOUNTANT", isActive:true, passwordHash:pw },
    create: { email:"finance@school.edu", name:"Finance Officer", passwordHash:pw, role:"BURSAR_ACCOUNTANT", isActive:true },
  });

  // Form Teacher
  const ftUser = await prisma.user.upsert({
    where:  { email:"adaeze@school.edu" },
    update: {},
    create: { email:"adaeze@school.edu", name:"Mrs. Adaeze Obi", passwordHash:pw, role:"FORM_TEACHER", isActive:true },
  });
  const ftTeacher = await prisma.teacher.upsert({
    where:  { userId: ftUser.id },
    update: {},
    create: { userId:ftUser.id, employeeId:"TCH001", formClassId:cls1.id },
  });
  // Update class with form teacher
  await prisma.class.update({ where:{ id:cls1.id }, data:{ formTeacher:{ connect:{ id:ftTeacher.id } } } });

  // Subject Teacher
  const stUser = await prisma.user.upsert({
    where:  { email:"ngozi@school.edu" },
    update: {},
    create: { email:"ngozi@school.edu", name:"Miss Ngozi Eze", passwordHash:pw, role:"SUBJECT_TEACHER", isActive:true },
  });
  const stTeacher = await prisma.teacher.upsert({
    where:  { userId: stUser.id },
    update: {},
    create: { userId:stUser.id, employeeId:"TCH002" },
  });

  // Subject assignments
  for (const config of classConfigs) {
    const schoolClass = classes.get(config.name)!;
    const configuredSubjectIds = config.subjects.map(subjectName => subjects.get(subjectName)!.id);
    await prisma.subjectAssignment.deleteMany({
      where: {
        teacherId: stTeacher.id,
        classId: schoolClass.id,
        subjectId: { notIn: configuredSubjectIds },
      },
    });
    for (const subjectName of config.subjects) {
      const subject = subjects.get(subjectName)!;
      await prisma.subjectAssignment.upsert({
        where:  { teacherId_subjectId_classId:{ teacherId:stTeacher.id, subjectId:subject.id, classId:schoolClass.id } },
        update: { sessionId:session.id },
        create: { teacherId:stTeacher.id, subjectId:subject.id, classId:schoolClass.id, sessionId:session.id },
      });
    }
  }
  console.log("✓ Teachers");

  await seedStaff(prisma, session.id, pw);

  // Parent
  const parentUser = await prisma.user.upsert({
    where:  { email:"parent@school.edu" },
    update: {},
    create: { email:"parent@school.edu", name:"Mr. Emeka Okonkwo", passwordHash:pw, role:"PARENT", isActive:true },
  });
  const parent = await prisma.parent.upsert({
    where:  { userId:parentUser.id },
    update: {},
    create: { userId:parentUser.id, occupation:"Engineer", relationship:"PARENT" },
  });

  // Applicant
  await prisma.user.upsert({
    where:  { email:"applicant@school.edu" },
    update: {},
    create: { email:"applicant@school.edu", name:"Fatima Bello", passwordHash:pw, role:"APPLICANT", isActive:true },
  });

  // ── Students ──────────────────────────────────────────────────
  const students = [];
  const names = [
    ["Amaka","Okonkwo"],["Chidi","Nzediegwu"],["Fatima","Bello"],["Emeka","Eze"],
    ["Ngozi","Adeyemi"],["Tobi","Lawal"],["Yetunde","Abiodun"],["Kunle","Fadahunsi"],
    ["Bisi","Olatunde"],["Segun","Adeleke"],
  ];
  for (let i = 0; i < names.length; i++) {
    const [firstName, lastName] = names[i];
    const student = await prisma.student.upsert({
      where:  { studentId:`STU/2024/${String(i+1).padStart(3,"0")}` },
      update: {},
      create: {
        studentId: `STU/2024/${String(i+1).padStart(3,"0")}`,
        firstName, lastName,
        dateOfBirth: new Date(`${2012 + (i % 3)}-0${(i%9)+1}-15`),
        gender: i % 2 === 0 ? "FEMALE" : "MALE",
        classId: cls1.id,
        isActive: true,
      },
    });
    students.push(student);

    // Link first student to parent
    if (i === 0) {
      await prisma.parentStudent.upsert({
        where:  { parentId_studentId:{ parentId:parent.id, studentId:student.id } },
        update: {},
        create: { parentId:parent.id, studentId:student.id, isPrimary:true },
      });
    }
  }
  console.log("✓ Students + parent link");

  // ── Sample results ────────────────────────────────────────────
  for (let i = 0; i < students.length; i++) {
    const ca1  = Math.floor(Math.random() * 4 + 7);  // 7-10
    const ca2  = Math.floor(Math.random() * 4 + 6);  // 6-9
    const ca3  = Math.floor(Math.random() * 3 + 7);  // 7-9
    const exam = Math.floor(Math.random() * 20 + 50);// 50-69
    const total = ca1 + ca2 + ca3 + exam;

    await prisma.result.upsert({
      where:  { studentId_subjectId_sessionId_term:{ studentId:students[i].id, subjectId:maths.id, sessionId:session.id, term:"FIRST" } },
      update: {},
      create: {
        studentId:students[i].id, classId:cls1.id, subjectId:maths.id,
        sessionId:session.id, term:"FIRST",
        ca1, ca2, ca3, examScore:exam, total,
        maxCA1:10, maxCA2:10, maxCA3:10, maxExam:70, maxTotal:100,
        status: i < 5 ? "SUBMITTED" : "DRAFT",
      },
    });
  }
  console.log("✓ Sample results");

  // ── Entrance exam ─────────────────────────────────────────────
  const exam = await prisma.exam.upsert({
    where:  { id:"exam_entrance_2025" },
    update: {},
    create: {
      id:              "exam_entrance_2025",
      title:           "2025/2026 Entrance Examination",
      type:            "ENTRANCE",
      sessionId:       session.id,
      durationMinutes: 60,
      passMark:        50,
      totalMarks:      100,
      scheduledStart:  new Date(Date.now() - 3600000),  // started 1hr ago
      scheduledEnd:    new Date(Date.now() + 7200000),   // ends in 2hrs
      isPublished:     true,
      shuffleQuestions:true,
      shuffleOptions:  true,
      showResultImmediately: true,
      instructions:    "Attempt all questions. No calculator allowed. Read each question carefully.",
      createdById:     adminUser.id,
    },
  });

  // Questions
  const questions = [
    { text:"What is 15 × 8?",               type:"MCQ",       marks:2, options:[{id:"a",text:"100"},{id:"b",text:"120"},{id:"c",text:"110"},{id:"d",text:"125"}], correct:"b" },
    { text:"The capital of Nigeria is ___.", type:"MCQ",       marks:2, options:[{id:"a",text:"Lagos"},{id:"b",text:"Ibadan"},{id:"c",text:"Abuja"},{id:"d",text:"Kano"}], correct:"c" },
    { text:"Water boils at 100°C at sea level.",type:"TRUE_FALSE",marks:1,options:null,correct:"true" },
    { text:"The sun is a planet.",           type:"TRUE_FALSE",marks:1,options:null,correct:"false" },
    { text:"Name two renewable energy sources.", type:"SHORT_ANSWER", marks:3, options:null, correct:null },
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.upsert({
      where:  { id:`q_entrance_${i+1}` },
      update: {},
      create: {
        id:            `q_entrance_${i+1}`,
        examId:        exam.id,
        type:          q.type as any,
        text:          q.text,
        marks:         q.marks,
        order:         i,
        options:       q.options as any,
        correctAnswer: q.correct,
        keywords:      q.type === "SHORT_ANSWER" ? ["solar","wind","hydro","geothermal","biomass"] : [],
      },
    });
  }
  console.log("✓ Entrance exam + questions");

  // ── Audit log entry ───────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId:      adminUser.id,
      action:      "CREATE",
      entity:      "System",
      description: "Database seeded with demo data",
      newValue:    { seeded: true, students: students.length, session: session.name },
    },
  });

  console.log("✅ Seed complete!");
  await cleanupDemoData(prisma);
  console.log("Demo data removed");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
