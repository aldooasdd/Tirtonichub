-- Jembatan UI Tirtonic Studio: kolom tambahan + dokumen umum + jejak hapus
ALTER TABLE "MediaMember" ADD COLUMN "extra" JSONB;
ALTER TABLE "MediaItem" ADD COLUMN "extra" JSONB;
ALTER TABLE "MediaTask" ADD COLUMN "readyBy" TEXT;
ALTER TABLE "MediaTask" ADD COLUMN "extra" JSONB;
ALTER TABLE "MediaSettings" ADD COLUMN "extra" JSONB;

-- CreateTable
CREATE TABLE "StudioDoc" (
    "path" TEXT NOT NULL,
    "coll" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioDoc_pkey" PRIMARY KEY ("path")
);

-- CreateTable
CREATE TABLE "StudioTombstone" (
    "path" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioTombstone_pkey" PRIMARY KEY ("path")
);

-- CreateIndex
CREATE INDEX "StudioDoc_coll_idx" ON "StudioDoc"("coll");
CREATE INDEX "StudioDoc_updatedAt_idx" ON "StudioDoc"("updatedAt");
CREATE INDEX "StudioTombstone_deletedAt_idx" ON "StudioTombstone"("deletedAt");
