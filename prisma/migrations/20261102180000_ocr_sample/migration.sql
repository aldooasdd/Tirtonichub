-- CreateTable
CREATE TABLE "OcrSample" (
    "batchId" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "aiRows" TEXT NOT NULL,
    "finalRows" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrSample_pkey" PRIMARY KEY ("batchId")
);

-- CreateIndex
CREATE INDEX "OcrSample_brandKey_updatedAt_idx" ON "OcrSample"("brandKey", "updatedAt");
