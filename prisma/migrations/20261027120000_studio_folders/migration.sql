-- File Konten: folder buatan sendiri
ALTER TABLE "MediaAsset" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "MediaAsset" ADD COLUMN "folderId" TEXT;
CREATE INDEX "MediaAsset_folderId_idx" ON "MediaAsset"("folderId");
