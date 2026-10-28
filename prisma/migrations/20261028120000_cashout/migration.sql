-- CreateTable
CREATE TABLE "Cashout" (
    "id" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,
    "photoKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "Cashout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cashout_createdById_idx" ON "Cashout"("createdById");
CREATE INDEX "Cashout_spentAt_idx" ON "Cashout"("spentAt");
CREATE INDEX "Cashout_approvedAt_idx" ON "Cashout"("approvedAt");

-- AddForeignKey
ALTER TABLE "Cashout" ADD CONSTRAINT "Cashout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
