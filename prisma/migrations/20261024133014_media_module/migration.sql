-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('ADMIN', 'ADMIN2', 'MEMBER');

-- CreateEnum
CREATE TYPE "MediaTier" AS ENUM ('EX', 'LS', 'JP');

-- CreateTable
CREATE TABLE "MediaMember" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" "MediaRole" NOT NULL DEFAULT 'MEMBER',
    "idcc" BOOLEAN NOT NULL DEFAULT false,
    "offDays" INTEGER[],
    "phone" TEXT,
    "avColor" TEXT NOT NULL DEFAULT 'lime',
    "avAnimal" TEXT,
    "avPhotoKey" TEXT,
    "pcalColor" TEXT NOT NULL DEFAULT 'lime',
    "pcalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaMember_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "cat" TEXT NOT NULL,
    "gender" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "arrived" DATE NOT NULL,
    "tier" "MediaTier" NOT NULL DEFAULT 'JP',
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "old" BOOLEAN NOT NULL DEFAULT false,
    "thumb" TEXT,
    "photoKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaTask" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cat" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Terdata',
    "source" TEXT,
    "reason" TEXT,
    "producer" TEXT,
    "editor" TEXT,
    "talent" TEXT,
    "script" TEXT,
    "shootPlan" TEXT,
    "editPlan" TEXT,
    "postAt" TEXT,
    "postTime" TEXT,
    "due" TEXT,
    "target" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "metaAt" TIMESTAMP(3),
    "driveUrl" TEXT,
    "note" TEXT,
    "history" JSONB,
    "eventKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "jobdesk" JSONB,
    "idccDay" INTEGER NOT NULL DEFAULT 3,
    "idccQty" INTEGER NOT NULL DEFAULT 10,
    "idccDays" INTEGER NOT NULL DEFAULT 90,
    "captionTemplate" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaIdccReport" (
    "id" TEXT NOT NULL,
    "reportDate" DATE,
    "data" JSONB NOT NULL,
    "summary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaIdccReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaBalanceLog" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "entries" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaBalanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCalEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT,
    "color" TEXT NOT NULL DEFAULT 'lime',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaMember_code_key" ON "MediaMember"("code");

-- CreateIndex
CREATE INDEX "MediaItem_createdById_idx" ON "MediaItem"("createdById");

-- CreateIndex
CREATE INDEX "MediaItem_arrived_idx" ON "MediaItem"("arrived");

-- CreateIndex
CREATE INDEX "MediaTask_status_idx" ON "MediaTask"("status");

-- CreateIndex
CREATE INDEX "MediaTask_itemId_idx" ON "MediaTask"("itemId");

-- CreateIndex
CREATE INDEX "MediaTask_postAt_idx" ON "MediaTask"("postAt");

-- CreateIndex
CREATE INDEX "PersonalCalEvent_userId_idx" ON "PersonalCalEvent"("userId");

-- AddForeignKey
ALTER TABLE "MediaMember" ADD CONSTRAINT "MediaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTask" ADD CONSTRAINT "MediaTask_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MediaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalEvent" ADD CONSTRAINT "PersonalCalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
