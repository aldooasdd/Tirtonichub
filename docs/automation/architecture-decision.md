# ADR — Workflow Automation Tirtonic Media (21 Nov 2026)

## Konteks (hasil audit)
- Aplikasi: Next.js 16 + React 19 + Prisma 6 + PostgreSQL, satu proses di PC kantor (Docker Compose), deploy otomatis saat merge ke `main` (`.github/workflows/deploy.yml`: build → `prisma migrate deploy` → health check).
- Sudah ada **worker latar** tahan restart: `pushTick` (tiap menit, `src/instrumentation.ts`) dengan antrean di database (WA editor jeda 15 menit, Foto katalog, WA pagi).
- Data CPR (kartu Studio) di `MediaTask` (+ kolom `extra` JSON: `brief`, `qa`, `cprId`…), diubah lewat `src/server/studio/store.ts` (Studio) dan `src/server/actions/media-tasks.ts` (dasbor). Notifikasi: `sendPush` (lonceng + push + WA).
- Peran: admin penuh (BOSS / MediaMember ADMIN), Admin 2, anggota. Tidak ada multi-organisasi (satu workspace).

## Keputusan
**Antrean & worker berbasis database (PostgreSQL) di proses yang sama**, bukan Inngest/Temporal.
- Inngest: butuh akun/servis eksternal + endpoint publik; tidak ada kredensial dan PC kantor tidak dirancang untuk itu.
- Temporal: butuh server + worker terpisah yang harus dirawat; berlebihan untuk skala tim 3–4 orang.
- DB-backed: memakai infrastruktur yang sudah berjalan (PostgreSQL + `pushTick`), tanpa biaya/kunci tambahan.

## Desain
- **Outbox transaksional**: `taskEvents(before, after)` menurunkan event bisnis; disimpan ke `AutomationEvent` dalam `prisma.$transaction` yang sama dengan perubahan kartu. `dedupeKey` unik mencegah event ganda.
- **Dispatcher**: `automationTick` (dipanggil `pushTick` tiap menit + disentak segera setelah event baru) mengklaim event dengan `UPDATE … FOR UPDATE SKIP LOCKED` + sewa 5 menit; gagal → coba lagi dengan jeda 2/4/8…60 menit, maks. 6 kali lalu `DEAD:` (DLQ).
- **Inbox** `(eventId, consumer)` unik: satu event diproses sekali per versi workflow / per run yang dilanjutkan.
- **Run** unik per `(workflow, versi, event)`; langkah tercatat di `AutomationRunStep`; langkah yang sudah selesai tidak diulang (replay-safe). Run yang macet (status running > 5 menit) dilanjutkan otomatis.
- **Tunggu keputusan orang**: run `waiting_for_human` dengan `waitKey = qa:<kartu>:v<versi>`; dilanjutkan oleh event `qa.completed.v1` yang lahir dari keputusan Creative Review (aksi terautentikasi di `cpr.ts`). Tidak pernah ada persetujuan otomatis.
- **Timer** di `AutomationTimer` (kunci unik), diklaim atomik; sebelum mengirim, kartu dibaca ulang (tahap, deadline, tanggal tayang, metrik sudah dicatat). Deadline berubah → timer lama dibatalkan.
- **Notifikasi** memakai `sendPush`; `AutomationDelivery` (kunci unik) mencegah kirim ganda.
- **Versi immutable** `AutomationWorkflowVersion`; draf diedit terpisah dengan penjaga konkurensi `draftRev`. Run memakai versi saat dimulai.
- **Keputusan bersamaan**: `qaAct` / `briefAct` per kartu dijalankan bergiliran (`src/server/studio/lock.ts`). Ini cukup karena aplikasi berjalan sebagai **satu proses**. Bila kelak dijalankan lebih dari satu instance, ganti dengan advisory lock PostgreSQL.
- **Keamanan**: node hanya dari daftar tetap (tanpa skrip/SQL/URL bebas); graf divalidasi di klien & server (`validate.ts`); izin dicek di setiap server action.
- **Saklar**: tombol Nyalakan/Matikan worker di halaman Otomasi (admin penuh, teraudit; disimpan di `AutomationPolicy` key `worker.enabled`). Bawaan **mati**: event tetap dicatat, tidak ada yang dijalankan. `AUTOMATION_ENABLED=0` di .env = saklar darurat. Setiap workflow juga harus diterbitkan dan aturan bisnisnya aktif.

## Pemetaan izin (ke peran yang sudah ada)
| Izin | Peran |
|---|---|
| automation.read, run.read, approval.read | admin penuh, Admin 2 |
| draft.edit, run.test, publish, policy.manage, audit.read | admin penuh |
| approval.decide | tetap aturan Creative Review yang ada (admin/Admin 2, bukan konten sendiri; admin penuh dengan alasan pengecualian) |

## Biaya & kepemilikan
Tanpa biaya tambahan. Dirawat bersama aplikasi Tirtonichub. Ketergantungan baru: `@xyflow/react` 12.3.6 (MIT).
