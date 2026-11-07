-- Keuangan Tirtonic Channel: status statement, transfer ke rekening, rincian dana per pesanan
ALTER TABLE "MarketplacePayout" ADD COLUMN "adjustment" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketplacePayout" ADD COLUMN "payStatus" TEXT;
ALTER TABLE "MarketplacePayout" ADD COLUMN "paymentId" TEXT;
ALTER TABLE "MarketplacePayout" ADD COLUMN "payTime" TIMESTAMP(3);

ALTER TABLE "MarketplaceOrder" ADD COLUMN "finance" JSONB;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "financeAt" TIMESTAMP(3);

CREATE TABLE "MarketplaceTransfer" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bankAccount" TEXT,
    "createdAtMp" TIMESTAMP(3) NOT NULL,
    "paidTime" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceTransfer_platform_paymentId_key" ON "MarketplaceTransfer"("platform", "paymentId");
CREATE INDEX "MarketplaceTransfer_createdAtMp_idx" ON "MarketplaceTransfer"("createdAtMp");
