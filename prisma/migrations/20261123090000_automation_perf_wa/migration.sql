-- Keputusan Zaki 23 Nov 2026: pengingat metrik D+7 (workflow E) juga dikirim lewat WhatsApp.
-- Saluran umum Otomasi (B) tetap aplikasi saja. Aman diulang; versi naik & tercatat di Audit Log.
UPDATE "AutomationPolicy"
SET "config" = '{"days":[7],"sendTime":"09:00","recipients":"reviewers","wa":true}', "status" = 'active', "version" = "version" + 1, "updatedBy" = 'Zaki (keputusan 23 Nov 2026)', "updatedAt" = now()
WHERE "key" = 'performance.checkpoints' AND "config" <> '{"days":[7],"sendTime":"09:00","recipients":"reviewers","wa":true}'::jsonb;

INSERT INTO "AutomationAudit" ("id", "actorType", "actorId", "action", "resourceType", "resourceId", "outcome", "correlationId")
SELECT 'mig3-performance.checkpoints', 'system', 'migrasi 20261123090000', 'policy.active', 'policy', 'performance.checkpoints', 'D+7 + WhatsApp (keputusan Zaki 23 Nov 2026)', 'migrasi:20261123090000'
WHERE NOT EXISTS (SELECT 1 FROM "AutomationAudit" a WHERE a."id" = 'mig3-performance.checkpoints');
