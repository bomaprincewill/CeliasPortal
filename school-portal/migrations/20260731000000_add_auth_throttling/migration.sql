CREATE TABLE "auth_throttles" (
    "identifier" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_throttles_pkey" PRIMARY KEY ("identifier")
);

CREATE INDEX "auth_throttles_lockedUntil_idx" ON "auth_throttles"("lockedUntil");
