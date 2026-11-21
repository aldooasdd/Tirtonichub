-- CPR: beri Content ID ke kartu lama yang masih berjalan (permintaan Zaki 21 Nov 2026).
-- Sasaran: jenis igf/vpr/vrv/evt, belum Tayang, tidak digabung ke kartu lain, belum hangus (dibuat ≤ 1 bulan lalu), belum punya ID.
-- Nomor per bulan dibuat (WIB), melanjutkan penghitung CprCounter (tidak bentrok dengan ID yang sudah ada).
-- QA tidak diwajibkan (qaReq tidak diisi): QA bisa dipakai, tetapi tidak mengunci Tayang/Meta kartu lama.
-- Aman dijalankan ulang: hanya kartu yang cprId-nya masih kosong.
WITH target AS (
  SELECT "id", "type",
         to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYMM') AS yymm,
         "createdAt"
  FROM "MediaTask"
  WHERE "cprId" IS NULL
    AND "type" IN ('igf', 'vpr', 'vrv', 'evt')
    AND "status" IN ('Terdata', 'Diproduksi', 'Editing', 'Ready', 'Rencana', 'Siap Produksi', 'QC', 'Terjadwal')
    AND COALESCE("extra"->>'mergedInto', '') = ''
    AND "createdAt" >= now() - interval '1 month'
),
numbered AS (
  SELECT t."id", t."type", t.yymm,
         COALESCE(c."last", 0) + row_number() OVER (PARTITION BY t.yymm ORDER BY t."createdAt", t."id") AS n
  FROM target t
  LEFT JOIN "CprCounter" c ON c."month" = t.yymm
),
upd AS (
  UPDATE "MediaTask" m
  SET "cprId" = 'TRT-CPR-' ||
        CASE n."type" WHEN 'igf' THEN 'FIP' WHEN 'vpr' THEN 'VPD' WHEN 'vrv' THEN 'VRV' ELSE 'VEV' END ||
        '-' || n.yymm || '-' || lpad(n.n::text, 4, '0'),
      "updatedAt" = now()
  FROM numbered n
  WHERE m."id" = n."id"
  RETURNING n.yymm, n.n
)
INSERT INTO "CprCounter" ("month", "last")
SELECT yymm, max(n) FROM upd GROUP BY yymm
ON CONFLICT ("month") DO UPDATE SET "last" = GREATEST("CprCounter"."last", EXCLUDED."last");
