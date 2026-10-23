-- CreateEnum
CREATE TYPE "RawProductStatus" AS ENUM ('DRAFT', 'QC', 'STOCK', 'REJECTED');

-- CreateTable
CREATE TABLE "RawProduct" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "notaDate" DATE,
    "notaPhotoKey" TEXT,
    "status" "RawProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "qcById" TEXT,
    "qcAt" TIMESTAMP(3),
    "qcNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawProduct_status_idx" ON "RawProduct"("status");

-- CreateIndex
CREATE INDEX "RawProduct_batchId_idx" ON "RawProduct"("batchId");

-- CreateIndex
CREATE INDEX "RawProduct_createdById_idx" ON "RawProduct"("createdById");

-- AddForeignKey
ALTER TABLE "RawProduct" ADD CONSTRAINT "RawProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawProduct" ADD CONSTRAINT "RawProduct_qcById_fkey" FOREIGN KEY ("qcById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
