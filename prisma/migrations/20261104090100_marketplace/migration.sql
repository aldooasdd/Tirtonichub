-- Role baru Tirtonic Channel
INSERT INTO "Role" ("id", "code", "name") VALUES ('role_channel', 'CHANNEL', 'Tirtonic Channel') ON CONFLICT ("code") DO NOTHING;

-- CreateTable
CREATE TABLE "MarketplaceShop" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopName" TEXT,
    "cipher" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderSn" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "buyer" TEXT,
    "items" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "netAmount" INTEGER,
    "trackingNo" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "updatedAtMp" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceItem" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "warehouseId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePayout" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "revenue" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceShop_platform_shopId_key" ON "MarketplaceShop"("platform", "shopId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_orderedAt_idx" ON "MarketplaceOrder"("orderedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_platform_orderSn_key" ON "MarketplaceOrder"("platform", "orderSn");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceItem_platform_itemId_modelId_key" ON "MarketplaceItem"("platform", "itemId", "modelId");

-- CreateIndex
CREATE INDEX "MarketplacePayout_paidAt_idx" ON "MarketplacePayout"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePayout_platform_refId_key" ON "MarketplacePayout"("platform", "refId");
