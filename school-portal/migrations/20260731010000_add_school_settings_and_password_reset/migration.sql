CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

CREATE TABLE "school_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "motto" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "maxCA1" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "maxCA2" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "maxCA3" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "maxExam" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grade_bands" (
  "id" TEXT NOT NULL,
  "settingId" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "minScore" DOUBLE PRECISION NOT NULL,
  "maxScore" DOUBLE PRECISION NOT NULL,
  "remark" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grade_bands_settingId_grade_key" ON "grade_bands"("settingId", "grade");
CREATE INDEX "grade_bands_settingId_sortOrder_idx" ON "grade_bands"("settingId", "sortOrder");
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "school_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
