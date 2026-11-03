-- CreateTable
CREATE TABLE "CashDeposit" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "photoKey" TEXT NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashDeposit_branchId_depositedAt_idx" ON "CashDeposit"("branchId", "depositedAt");

-- CreateIndex
CREATE INDEX "CashDeposit_depositedAt_idx" ON "CashDeposit"("depositedAt");
