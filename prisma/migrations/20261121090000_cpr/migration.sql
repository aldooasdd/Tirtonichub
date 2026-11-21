-- CPR tahap 1: Content ID permanen di kartu Studio + penghitung nomor urut per bulan.
-- Tidak menghapus/mengubah data lama: kolom baru boleh kosong, kartu lama tidak diberi ID.
ALTER TABLE "MediaTask" ADD COLUMN "cprId" TEXT;
CREATE UNIQUE INDEX "MediaTask_cprId_key" ON "MediaTask"("cprId");

CREATE TABLE "CprCounter" (
    "month" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CprCounter_pkey" PRIMARY KEY ("month")
);
