-- Antrian Cek SKU: baris hasil cocok Accurate yang RAGU / TIDAK KETEMU, dicek orang toko.
CREATE TABLE "SkuCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "saranNama" TEXT,
    "saranUpc" TEXT,
    "saranStok" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sku" TEXT,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkuCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkuCheck_itemId_key" ON "SkuCheck"("itemId");
CREATE INDEX "SkuCheck_groupKey_idx" ON "SkuCheck"("groupKey");
CREATE INDEX "SkuCheck_status_idx" ON "SkuCheck"("status");
