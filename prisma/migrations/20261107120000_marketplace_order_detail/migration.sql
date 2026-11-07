-- Detail pengiriman order marketplace (untuk Kelola Pesanan)
ALTER TABLE "MarketplaceOrder" ADD COLUMN "recipient" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "phone" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "address" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "courier" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "buyerNote" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN "payment" TEXT;
