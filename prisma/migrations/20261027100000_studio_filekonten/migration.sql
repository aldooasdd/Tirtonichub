-- File Konten: bagian per jenis konten, tugas asal, label warna, waktu ubah (rename/warna ikut sinkron)
ALTER TABLE "MediaAsset" ADD COLUMN "section" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "taskId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "color" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
