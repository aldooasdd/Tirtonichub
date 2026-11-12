-- Foto kegiatan demo komunitas (diunggah dari tirtonic.com, disimpan di PC server).
CREATE TABLE "DemoPhoto" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "community" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DemoPhoto_claimId_idx" ON "DemoPhoto"("claimId");
