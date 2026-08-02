CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED');

ALTER TABLE "students" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "student_enrollments" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT,
  "promotedFromId" TEXT,
  "createdById" TEXT,
  CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_enrollments_studentId_sessionId_key" ON "student_enrollments"("studentId", "sessionId");
CREATE INDEX "student_enrollments_classId_sessionId_status_idx" ON "student_enrollments"("classId", "sessionId", "status");
CREATE INDEX "student_enrollments_studentId_enrolledAt_idx" ON "student_enrollments"("studentId", "enrolledAt");
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "student_enrollments" ("id", "studentId", "classId", "sessionId", "status", "enrolledAt")
SELECT 'enr_' || md5(random()::text || s."id"), s."id", s."classId", c."sessionId", 'ACTIVE'::"EnrollmentStatus", s."admissionDate"
FROM "students" s JOIN "classes" c ON c."id" = s."classId"
WHERE s."classId" IS NOT NULL
ON CONFLICT ("studentId", "sessionId") DO NOTHING;
