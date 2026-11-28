ALTER TABLE "InboxMessage" ADD COLUMN "mediaUrl" TEXT;
CREATE TABLE "InboxTemplate" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InboxAuto" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "balasan" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxAuto_pkey" PRIMARY KEY ("id")
);
