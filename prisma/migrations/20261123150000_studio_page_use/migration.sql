-- Pemakaian halaman Studio (hanya tabel baru; aman dijalankan ulang).
CREATE TABLE IF NOT EXISTS "StudioPageUse" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioPageUse_pkey" PRIMARY KEY ("userId","day","page")
);
CREATE INDEX IF NOT EXISTS "StudioPageUse_day_idx" ON "StudioPageUse"("day");
