-- Kirim pesanan Tokopedia: paket, opsi pengiriman, tipe pengiriman
ALTER TABLE "MarketplaceOrder" ADD COLUMN "packageId" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "deliveryOptionId" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "shippingType" TEXT;
