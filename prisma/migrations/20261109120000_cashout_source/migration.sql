-- Pembelian: sumber uang (kasir / bank)
ALTER TABLE "Cashout" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'KASIR';
