-- Hapus tahap approval: offline sales & cashout yang masih nyangkut → anggap tersetujui (masuk rekap Finance).
UPDATE "SalesReport"
SET "branchApprovedAt" = COALESCE("branchApprovedAt", now()),
    "approvedAt" = COALESCE("approvedAt", now())
WHERE "channel" = 'offline' AND "approvedAt" IS NULL;

UPDATE "Cashout"
SET "approvedAt" = COALESCE("approvedAt", now())
WHERE "approvedAt" IS NULL;
