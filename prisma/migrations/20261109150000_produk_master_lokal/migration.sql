-- Produk Master: nama & SKU editan lokal + sampah.
ALTER TABLE "MarketplaceItem" ADD COLUMN "localName" TEXT;
ALTER TABLE "MarketplaceItem" ADD COLUMN "localSku" TEXT;
ALTER TABLE "MarketplaceItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
