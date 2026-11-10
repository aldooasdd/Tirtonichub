-- Kasir /pos: password per cabang + akun sales per penjualan (bonus).
ALTER TABLE "Branch" ADD COLUMN "posPasswordHash" TEXT;
ALTER TABLE "SalesReport" ADD COLUMN "salesUserId" TEXT;
