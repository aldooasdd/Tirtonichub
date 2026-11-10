-- Campaign layar depan kasir /pos.
CREATE TABLE "PosCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaKey" TEXT NOT NULL,
    "isVideo" BOOLEAN NOT NULL DEFAULT false,
    "branchId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PosCampaign_active_idx" ON "PosCampaign"("active");
