-- Keputusan Zaki 22 Nov 2026 (sebelum menyalakan workflow B & E): supaya tidak ramai.
--   pengingat metrik (E) = D+7 saja, pukul 09.00 WIB, ke reviewer
--   saluran notifikasi Otomasi = aplikasi saja (lonceng + push), tanpa WhatsApp
-- Aman diulang: hanya mengubah bila isinya belum sama; versi naik & tercatat di Audit Log.
UPDATE "AutomationPolicy"
SET "config" = '{"days":[7],"sendTime":"09:00","recipients":"reviewers"}', "status" = 'active', "version" = "version" + 1, "updatedBy" = 'Zaki (keputusan 22 Nov 2026)', "updatedAt" = now()
WHERE "key" = 'performance.checkpoints' AND "config" <> '{"days":[7],"sendTime":"09:00","recipients":"reviewers"}'::jsonb;

UPDATE "AutomationPolicy"
SET "config" = '{"channel":"app"}', "status" = 'active', "version" = "version" + 1, "updatedBy" = 'Zaki (keputusan 22 Nov 2026)', "updatedAt" = now()
WHERE "key" = 'notify.channel' AND "config" <> '{"channel":"app"}'::jsonb;

INSERT INTO "AutomationAudit" ("id", "actorType", "actorId", "action", "resourceType", "resourceId", "outcome", "correlationId")
SELECT 'mig2-' || k, 'system', 'migrasi 20261122210000', 'policy.active', 'policy', k, 'keputusan Zaki 22 Nov 2026 (lebih tenang)', 'migrasi:20261122210000'
FROM unnest(ARRAY['performance.checkpoints','notify.channel']) AS k
WHERE NOT EXISTS (SELECT 1 FROM "AutomationAudit" a WHERE a."id" = 'mig2-' || k);
