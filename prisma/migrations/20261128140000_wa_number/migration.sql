CREATE TABLE "WaNumber" (
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayPhone" TEXT,
    "token" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaNumber_pkey" PRIMARY KEY ("phoneNumberId")
);
