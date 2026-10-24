CREATE TABLE "MediaPcal" (
  "userId" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'lime',
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaPcal_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "MediaPcal" ADD CONSTRAINT "MediaPcal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
