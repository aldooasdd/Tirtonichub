-- CreateTable
CREATE TABLE "SalesReport" (
    "id" TEXT NOT NULL,
    "notaNo" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "customer" TEXT,
    "salesman" TEXT,
    "employee" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "payments" JSONB NOT NULL,
    "photoKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesReport_createdById_idx" ON "SalesReport"("createdById");

-- CreateIndex
CREATE INDEX "SalesReport_soldAt_idx" ON "SalesReport"("soldAt");

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
