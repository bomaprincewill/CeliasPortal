-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'FORM_TEACHER', 'SUBJECT_TEACHER', 'PARENT', 'APPLICANT', 'STUDENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('FIRST', 'SECOND', 'THIRD');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('TERMINAL', 'ENTRANCE', 'MOCK', 'CA');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SUBMIT', 'APPROVE', 'LOCK', 'UNLOCK', 'UPLOAD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arm" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_assignments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "qualification" TEXT,
    "specialization" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formClassId" TEXT,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT,
    "bloodGroup" TEXT,
    "stateOfOrigin" TEXT,
    "lgaOfOrigin" TEXT,
    "religion" TEXT,
    "photoUrl" TEXT,
    "classId" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occupation" TEXT,
    "relationship" TEXT NOT NULL DEFAULT 'PARENT',

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_students" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "relationship" TEXT NOT NULL DEFAULT 'PARENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "applyingForClass" TEXT NOT NULL,
    "academicSession" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT,
    "photoUrl" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "admissionScore" DOUBLE PRECISION,
    "offerDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "term" "Term" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "takenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ExamType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "classId" TEXT,
    "subjectId" TEXT,
    "term" "Term",
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "passMark" INTEGER NOT NULL DEFAULT 50,
    "totalMarks" INTEGER NOT NULL DEFAULT 100,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "showResultImmediately" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "correctAnswer" TEXT,
    "sampleAnswer" TEXT,
    "explanation" TEXT,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_submissions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT,
    "applicantId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "timeUsedSeconds" INTEGER,
    "rawScore" DOUBLE PRECISION,
    "totalMarks" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "isPassed" BOOLEAN,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isAutoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbt_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_answers" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "ca1" DOUBLE PRECISION,
    "ca2" DOUBLE PRECISION,
    "ca3" DOUBLE PRECISION,
    "examScore" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "grade" TEXT,
    "gradePoint" DOUBLE PRECISION,
    "remark" TEXT,
    "position" INTEGER,
    "maxCA1" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxCA2" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxCA3" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxExam" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "maxTotal" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "teacherComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_comments" (
    "id" TEXT NOT NULL,
    "resultId" TEXT,
    "studentId" TEXT,
    "classId" TEXT,
    "sessionId" TEXT,
    "term" "Term",
    "teacherId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broad_sheets" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER,
    "outOf" INTEGER,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedById" TEXT,

    CONSTRAINT "broad_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "classes_sessionId_idx" ON "classes"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_arm_sessionId_key" ON "classes"("name", "arm", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "subject_assignments_teacherId_idx" ON "subject_assignments"("teacherId");

-- CreateIndex
CREATE INDEX "subject_assignments_classId_idx" ON "subject_assignments"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_assignments_teacherId_subjectId_classId_key" ON "subject_assignments"("teacherId", "subjectId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_userId_key" ON "teachers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_employeeId_key" ON "teachers"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_formClassId_key" ON "teachers"("formClassId");

-- CreateIndex
CREATE INDEX "teachers_userId_idx" ON "teachers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_studentId_key" ON "students"("studentId");

-- CreateIndex
CREATE INDEX "students_classId_idx" ON "students"("classId");

-- CreateIndex
CREATE INDEX "students_studentId_idx" ON "students"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parents_userId_key" ON "parents"("userId");

-- CreateIndex
CREATE INDEX "parent_students_studentId_idx" ON "parent_students"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_students_parentId_studentId_key" ON "parent_students"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_userId_key" ON "applicants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_applicationNo_key" ON "applicants"("applicationNo");

-- CreateIndex
CREATE INDEX "applicants_applicationNo_idx" ON "applicants"("applicationNo");

-- CreateIndex
CREATE INDEX "attendance_classId_date_idx" ON "attendance"("classId", "date");

-- CreateIndex
CREATE INDEX "attendance_studentId_sessionId_idx" ON "attendance"("studentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_studentId_date_key" ON "attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "exams_sessionId_type_idx" ON "exams"("sessionId", "type");

-- CreateIndex
CREATE INDEX "exams_classId_idx" ON "exams"("classId");

-- CreateIndex
CREATE INDEX "questions_examId_idx" ON "questions"("examId");

-- CreateIndex
CREATE INDEX "cbt_submissions_examId_idx" ON "cbt_submissions"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "cbt_submissions_examId_studentId_key" ON "cbt_submissions"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "cbt_submissions_examId_applicantId_key" ON "cbt_submissions"("examId", "applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "cbt_answers_submissionId_questionId_key" ON "cbt_answers"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "results_classId_sessionId_term_idx" ON "results"("classId", "sessionId", "term");

-- CreateIndex
CREATE INDEX "results_studentId_sessionId_idx" ON "results"("studentId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "results_studentId_subjectId_sessionId_term_key" ON "results"("studentId", "subjectId", "sessionId", "term");

-- CreateIndex
CREATE INDEX "broad_sheets_classId_sessionId_term_idx" ON "broad_sheets"("classId", "sessionId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "broad_sheets_classId_sessionId_term_studentId_key" ON "broad_sheets"("classId", "sessionId", "term", "studentId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_formClassId_fkey" FOREIGN KEY ("formClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_submissions" ADD CONSTRAINT "cbt_submissions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_submissions" ADD CONSTRAINT "cbt_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_submissions" ADD CONSTRAINT "cbt_submissions_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "cbt_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_comments" ADD CONSTRAINT "result_comments_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_comments" ADD CONSTRAINT "result_comments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broad_sheets" ADD CONSTRAINT "broad_sheets_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
