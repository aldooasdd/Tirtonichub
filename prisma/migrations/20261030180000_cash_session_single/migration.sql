-- 1 kasir/hari/cabang: hapus duplikat (sisakan buka paling awal), drop shift, unique [branchId,date].
DELETE FROM "CashSession" a USING "CashSession" b
WHERE a."branchId" = b."branchId" AND a."date" = b."date" AND a."openedAt" > b."openedAt";

DROP INDEX IF EXISTS "CashSession_branchId_date_shift_key";
ALTER TABLE "CashSession" DROP COLUMN IF EXISTS "shift";
CREATE UNIQUE INDEX "CashSession_branchId_date_key" ON "CashSession"("branchId", "date");
