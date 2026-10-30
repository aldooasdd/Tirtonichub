-- @Harga + Diskon per baris (sesuai PI). unitPrice tetap = modal net/unit.
ALTER TABLE "RawProduct" ADD COLUMN "listPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RawProduct" ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0;
-- Isi listPrice awal dari unitPrice lama (diskon 0) biar data lama konsisten.
UPDATE "RawProduct" SET "listPrice" = "unitPrice" WHERE "listPrice" = 0;
