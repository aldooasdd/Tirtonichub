-- Produk Master: detail produk marketplace + info varian
ALTER TABLE "MarketplaceItem" ADD COLUMN "variant" TEXT;
ALTER TABLE "MarketplaceItem" ADD COLUMN "image" TEXT;
ALTER TABLE "MarketplaceItem" ADD COLUMN "skuStatus" TEXT;

CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tokoStatus" TEXT,
    "description" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "images" JSONB NOT NULL,
    "video" JSONB,
    "attributes" JSONB NOT NULL,
    "weight" TEXT,
    "dimensions" TEXT,
    "minOrder" INTEGER,
    "isCod" BOOLEAN,
    "preOwned" BOOLEAN,
    "detailUrl" TEXT,
    "createdAtMp" TIMESTAMP(3),
    "updatedAtMp" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceProduct_platform_productId_key" ON "MarketplaceProduct"("platform", "productId");
