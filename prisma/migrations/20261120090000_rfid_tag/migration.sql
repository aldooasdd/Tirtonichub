-- Pasangkan Tag: stiker RFID ↔ SKU.
CREATE TABLE "RfidTag" (
    "epc" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RfidTag_pkey" PRIMARY KEY ("epc")
);
CREATE INDEX "RfidTag_sku_idx" ON "RfidTag"("sku");
