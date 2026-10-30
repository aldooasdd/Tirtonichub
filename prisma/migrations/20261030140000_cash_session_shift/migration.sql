-- CashSession: 2 shift per hari (PAGI/SIANG), 1 orang buka & wajib tutup per shift.
ALTER TABLE "CashSession" ADD COLUMN "shift" TEXT NOT NULL DEFAULT 'PAGI';
ALTER TABLE "CashSession" ALTER COLUMN "shift" DROP DEFAULT;

DROP INDEX "CashSession_branchId_date_key";
CREATE UNIQUE INDEX "CashSession_branchId_date_shift_key" ON "CashSession"("branchId", "date", "shift");
