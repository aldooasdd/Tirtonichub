-- SalesReport: nomor WA pelanggan untuk loyalty Ace Points (dinormalkan 62xxxx di aplikasi)
-- AlterTable
ALTER TABLE "SalesReport" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE INDEX "SalesReport_phone_idx" ON "SalesReport"("phone");
