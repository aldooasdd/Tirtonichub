ALTER TABLE "SalesReport" ADD COLUMN "branchId" TEXT;
ALTER TABLE "SalesReport" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "SalesReport" ADD COLUMN "approvedById" TEXT;
CREATE INDEX "SalesReport_channel_approvedAt_idx" ON "SalesReport"("channel", "approvedAt");
-- Data lama dianggap sudah disetujui (tetap tampil di Finance).
UPDATE "SalesReport" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;
