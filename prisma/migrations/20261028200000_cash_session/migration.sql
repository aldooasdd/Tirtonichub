CREATE TABLE "CashSession" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "openCash" INTEGER NOT NULL DEFAULT 0,
  "openMandiri" INTEGER NOT NULL DEFAULT 0,
  "openBca" INTEGER NOT NULL DEFAULT 0,
  "openBri" INTEGER NOT NULL DEFAULT 0,
  "openedById" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closeCash" INTEGER,
  "closeMandiri" INTEGER,
  "closeBca" INTEGER,
  "closeBri" INTEGER,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashSession_branchId_date_key" ON "CashSession"("branchId", "date");
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
