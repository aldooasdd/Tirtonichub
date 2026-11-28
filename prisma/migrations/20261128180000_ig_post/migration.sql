CREATE TABLE "IgPost" (
    "id" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "jadwal" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'TERJADWAL',
    "containerId" TEXT,
    "igMediaId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IgPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IgPost_status_jadwal_idx" ON "IgPost"("status", "jadwal");
