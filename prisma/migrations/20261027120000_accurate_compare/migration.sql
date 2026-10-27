-- CreateTable
CREATE TABLE "AccurateCompare" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "totalAccurate" INTEGER NOT NULL DEFAULT 0,
    "cocokCount" INTEGER NOT NULL DEFAULT 0,
    "selisihCount" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB NOT NULL,

    CONSTRAINT "AccurateCompare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccurateCompare_createdAt_idx" ON "AccurateCompare"("createdAt");
