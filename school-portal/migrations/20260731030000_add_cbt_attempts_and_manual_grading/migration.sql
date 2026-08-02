CREATE TYPE "CBTGradingStatus" AS ENUM ('AUTO_GRADED', 'PENDING_MANUAL', 'FINALIZED');

DROP INDEX IF EXISTS "cbt_submissions_examId_studentId_key";
DROP INDEX IF EXISTS "cbt_submissions_examId_applicantId_key";

ALTER TABLE "cbt_submissions"
  ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "gradingStatus" "CBTGradingStatus" NOT NULL DEFAULT 'AUTO_GRADED',
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT;

UPDATE "cbt_submissions" s SET "gradingStatus" = 'PENDING_MANUAL'
WHERE EXISTS (
  SELECT 1 FROM "cbt_answers" a JOIN "questions" q ON q."id" = a."questionId"
  WHERE a."submissionId" = s."id" AND q."type" IN ('ESSAY', 'SHORT_ANSWER') AND a."isCorrect" IS NULL
);

CREATE UNIQUE INDEX "cbt_submissions_examId_studentId_attemptNumber_key" ON "cbt_submissions"("examId", "studentId", "attemptNumber");
CREATE UNIQUE INDEX "cbt_submissions_examId_applicantId_attemptNumber_key" ON "cbt_submissions"("examId", "applicantId", "attemptNumber");

ALTER TABLE "cbt_answers"
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "gradedAt" TIMESTAMP(3),
  ADD COLUMN "gradedById" TEXT;
