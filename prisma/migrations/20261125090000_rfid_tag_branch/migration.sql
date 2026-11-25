-- Tag RFID per cabang. Tag lama: NULL = belum ada cabang.
ALTER TABLE "RfidTag" ADD COLUMN "branchId" TEXT;
