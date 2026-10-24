-- MediaItem: kategori opsional (auto-import dari QC belum tahu kategori), tambah sumber RawProduct + flag terjadwal
ALTER TABLE "MediaItem" ALTER COLUMN "cat" DROP NOT NULL;
ALTER TABLE "MediaItem" ADD COLUMN "sourceRawId" TEXT;
ALTER TABLE "MediaItem" ADD COLUMN "scheduled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "MediaItem_sourceRawId_key" ON "MediaItem"("sourceRawId");
