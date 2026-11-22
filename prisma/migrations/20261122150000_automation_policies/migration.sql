-- Aturan bisnis Workflow Automation yang DIPUTUSKAN Zaki (22 Nov 2026, lewat Claude Code):
--   A  pemetaan PIC      = jobdesk FlowSpace (hanya mengisi PIC yang kosong)
--      saluran notifikasi = aplikasi (lonceng + push) + WhatsApp
--   C  pengingat deadline = 24 jam & 3 jam sebelum Deadline Ready, Deadline dianggap 15.00 WIB, ke PIC kartu
--   E  pengingat metrik   = D+1, D+7, D+30 pukul 09.00 WIB, ke reviewer (admin & Admin 2)
-- Campaign master TIDAK diisi (belum ada definisi). Worker tetap MATI & workflow tetap draft sampai admin menerbitkan.
-- Aman diulang: hanya mengisi aturan yang belum pernah diatur; perubahan admin di halaman Konfigurasi tidak ditimpa.
INSERT INTO "AutomationPolicy" ("key", "status", "config", "version", "updatedBy", "updatedAt") VALUES
  ('assignment.mapping', 'active', '{"source":"jobdesk"}', 1, 'Zaki (keputusan 22 Nov 2026)', now()),
  ('notify.channel', 'active', '{"channel":"app_wa"}', 1, 'Zaki (keputusan 22 Nov 2026)', now()),
  ('reminder.schedule', 'active', '{"deadlineTime":"15:00","offsetsHours":[24,3],"recipients":"pic"}', 1, 'Zaki (keputusan 22 Nov 2026)', now()),
  ('performance.checkpoints', 'active', '{"days":[1,7,30],"sendTime":"09:00","recipients":"reviewers"}', 1, 'Zaki (keputusan 22 Nov 2026)', now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AutomationAudit" ("id", "actorType", "actorId", "action", "resourceType", "resourceId", "outcome", "correlationId")
SELECT 'mig-' || k, 'system', 'migrasi 20261122150000', 'policy.active', 'policy', k, 'v1 (keputusan Zaki 22 Nov 2026)', 'migrasi:20261122150000'
FROM unnest(ARRAY['assignment.mapping','notify.channel','reminder.schedule','performance.checkpoints']) AS k
WHERE NOT EXISTS (SELECT 1 FROM "AutomationAudit" a WHERE a."id" = 'mig-' || k);
