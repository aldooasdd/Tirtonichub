-- Keputusan Zaki 25 Nov 2026: workflow C (pengingat Deadline Ready) dinyalakan.
--   batas 15.00 WIB, satu pengingat 24 jam sebelumnya ke PIC kartu, aplikasi + WhatsApp khusus pengingat deadline.
--   Kartu yang sudah ada (belum Ready, Deadline Ready belum lewat) ikut dijadwalkan lewat event; data kartu TIDAK diubah.
-- Aman diulang. Worker tidak disentuh (tetap mengikuti saklar admin di halaman Otomasi).
INSERT INTO "AutomationPolicy" ("key", "status", "config", "version", "updatedBy", "updatedAt")
VALUES ('reminder.schedule', 'active', '{"deadlineTime":"15:00","offsetsHours":[24],"recipients":"pic","wa":true}', 1, 'Zaki (keputusan 25 Nov 2026)', timezone('utc', now()))
ON CONFLICT ("key") DO UPDATE SET "config" = EXCLUDED."config", "status" = 'active', "version" = "AutomationPolicy"."version" + 1, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = EXCLUDED."updatedAt"
WHERE "AutomationPolicy"."config" <> EXCLUDED."config" OR "AutomationPolicy"."status" <> 'active';

INSERT INTO "AutomationWorkflow" ("key", "name", "module", "status", "draft", "updatedAt")
VALUES ('deadline-reminder', 'Deadline Reminder', 'C', 'draft', '{"nodes":[{"id":"t","type":"trigger","data":{"event":"task.deadline_changed.v1"},"position":{"x":0,"y":0}},{"id":"w","type":"wait","data":{},"position":{"x":0,"y":130}},{"id":"e","type":"end","data":{},"position":{"x":0,"y":260}}],"edges":[{"id":"t-w","source":"t","target":"w","sourceHandle":null},{"id":"w-e","source":"w","target":"e","sourceHandle":null}]}', timezone('utc', now()))
ON CONFLICT ("key") DO NOTHING;

-- terbitkan versi baru hanya bila belum terbit (draf admin tidak ditimpa)
INSERT INTO "AutomationWorkflowVersion" ("id", "workflowKey", "version", "graph", "hash", "publishedBy", "publishedAt")
SELECT 'mig4-deadline-reminder', w."key", COALESCE((SELECT max(v."version") FROM "AutomationWorkflowVersion" v WHERE v."workflowKey" = w."key"), 0) + 1, '{"nodes":[{"id":"t","type":"trigger","data":{"event":"task.deadline_changed.v1"},"position":{"x":0,"y":0}},{"id":"w","type":"wait","data":{},"position":{"x":0,"y":130}},{"id":"e","type":"end","data":{},"position":{"x":0,"y":260}}],"edges":[{"id":"t-w","source":"t","target":"w","sourceHandle":null},{"id":"w-e","source":"w","target":"e","sourceHandle":null}]}', '4efc4be0955152b3', 'Zaki (keputusan 25 Nov 2026)', timezone('utc', now())
FROM "AutomationWorkflow" w WHERE w."key" = 'deadline-reminder' AND w."status" <> 'published'
ON CONFLICT DO NOTHING;
UPDATE "AutomationWorkflow" w SET "status" = 'published', "activeVersion" = v."version", "updatedBy" = 'Zaki (keputusan 25 Nov 2026)', "updatedAt" = timezone('utc', now())
FROM "AutomationWorkflowVersion" v WHERE v."id" = 'mig4-deadline-reminder' AND w."key" = v."workflowKey" AND w."status" <> 'published';

-- kartu yang sudah ada: event pemicu sekali per kartu
INSERT INTO "AutomationEvent" ("id", "dedupeKey", "type", "entityType", "entityId", "payload", "correlationId", "occurredAt", "nextAttemptAt")
SELECT 'mig4-' || t."id", 'task.deadline_changed.v1:' || t."id" || ':mig4', 'task.deadline_changed.v1', 'task', t."id",
       jsonb_build_object('type', t."type", 'deadline', x.dl, 'status', t."status"), 'migrasi:20261126090000', timezone('utc', now()), timezone('utc', now())
FROM "MediaTask" t
CROSS JOIN LATERAL (SELECT COALESCE(NULLIF(t."extra"->>'readyBy', ''), NULLIF(t."due", '')) AS dl) x
WHERE t."status" IN ('Terdata', 'Diproduksi', 'Editing', 'Rencana', 'Siap Produksi')
  AND (t."type" IN ('igf', 'vpr', 'vrv', 'evt') OR (t."type" IN ('idc', 'idf') AND t."cprId" IS NOT NULL))
  AND x.dl >= to_char(timezone('Asia/Jakarta', now()), 'YYYY-MM-DD')
  AND COALESCE(t."extra"->>'suspendedAt', '') = '' AND COALESCE(t."extra"->>'mergedInto', '') = ''
ON CONFLICT ("dedupeKey") DO NOTHING;

INSERT INTO "AutomationAudit" ("id", "actorType", "actorId", "action", "resourceType", "resourceId", "outcome", "correlationId")
SELECT 'mig4-reminder', 'system', 'migrasi 20261126090000', 'workflow.published', 'workflow', 'deadline-reminder', 'C aktif: 15.00 WIB, 24 jam, app + WhatsApp (keputusan Zaki 25 Nov 2026)', 'migrasi:20261126090000'
WHERE NOT EXISTS (SELECT 1 FROM "AutomationAudit" a WHERE a."id" = 'mig4-reminder');
