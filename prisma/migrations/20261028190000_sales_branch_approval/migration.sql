ALTER TABLE "SalesReport" ADD COLUMN "branchApprovedAt" TIMESTAMP(3);
ALTER TABLE "SalesReport" ADD COLUMN "branchApprovedById" TEXT;
-- Nota offline lama yang sudah ACC Finance dianggap sudah lolos Kepala Cabang.
UPDATE "SalesReport" SET "branchApprovedAt" = "approvedAt", "branchApprovedById" = "approvedById" WHERE "channel" = 'offline' AND "approvedAt" IS NOT NULL;
