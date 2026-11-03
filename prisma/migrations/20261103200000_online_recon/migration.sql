-- CreateTable
CREATE TABLE "OnlineRecon" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "actual" INTEGER NOT NULL,
    "note" TEXT,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineRecon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlineRecon_month_channel_key" ON "OnlineRecon"("month", "channel");
