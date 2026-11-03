-- CreateTable
CREATE TABLE "KatalogNotif" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "movedBy" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "KatalogNotif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KatalogNotif_sentAt_failedAt_idx" ON "KatalogNotif"("sentAt", "failedAt");

-- CreateIndex
CREATE INDEX "KatalogNotif_taskId_idx" ON "KatalogNotif"("taskId");
