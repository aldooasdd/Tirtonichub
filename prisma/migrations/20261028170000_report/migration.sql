CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "photoKey" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_resolvedAt_idx" ON "Report"("resolvedAt");
CREATE INDEX "Report_createdById_idx" ON "Report"("createdById");
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
