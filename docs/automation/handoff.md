# Serah terima — Workflow Automation (21 Nov 2026)

## 1. Sudah dibuat dan diuji
- Tabel baru (migrasi `20261122120000_automation`, hanya CREATE TABLE): workflow, versi, outbox event, inbox, run, langkah, timer, pengiriman, aturan, audit.
- Event dari perubahan kartu (Studio & dasbor) ditulis dalam transaksi yang sama: brief disetujui, Creative Review diajukan/diputuskan, deadline/PIC/tahap berubah, Campaign ID diisi, kartu Tayang.
- Mesin: run unik per event, langkah tidak diulang, tunggu keputusan orang, timer, coba ulang + DLQ, lanjut setelah restart, Test Run tanpa efek samping.
- Lima workflow bawaan (draf): A CPR → Task Assignment, B Creative Review → Human Approval, C Deadline Reminder, D Campaign Workflow, E Performance Monitoring.
- Halaman `/media/otomasi` (tab **Otomasi** di Studio): Workflows, Builder (React Flow + inspector + undo/redo + validasi + Test Run + Publish/Disable + riwayat versi), Runs, Approval Inbox, Audit Log, Konfigurasi.
- Uji otomatis: `src/server/automation/*.test.ts`, `src/server/studio/lock.test.ts` (event ganda, PIC tanpa aturan, checklist QA per jenis, QA lolos = menunggu orang, keputusan bersamaan, restart, deadline berubah, kartu Ready tidak diingatkan, campaign tidak aktif, versi terkunci, dry run).

## 2. Dibuat tetapi nonaktif / Needs Configuration
- Worker: **mati** sampai admin penuh menekan **Nyalakan worker** di halaman Otomasi (`AUTOMATION_ENABLED=0` di .env = saklar darurat paksa mati).
- Semua workflow masih **draft**; terbitkan dari Builder setelah aturannya aktif.
- Aturan bisnis (tab Konfigurasi) semuanya `needs_configuration` sampai admin mengisi: pemetaan PIC (jobdesk FlowSpace), saluran notifikasi, jadwal pengingat (jam batas + jarak jam), checkpoint evaluasi (D+1/D+7/D+30 + jam + penerima).

## 2b. Aturan yang diputuskan Zaki (22 Nov 2026, migrasi `20261122150000_automation_policies`)
- Pemetaan PIC: jobdesk FlowSpace (hanya mengisi yang kosong).
- Saluran: aplikasi + WhatsApp.
- Pengingat Deadline Ready: 24 & 3 jam sebelum, deadline 15.00 WIB, ke PIC kartu.
- Pengingat metrik: D+1, D+7, D+30 pukul 09.00 WIB, ke reviewer (admin & Admin 2).
Workflow tetap draft & worker tetap mati: Test Run → Publish → Nyalakan worker dilakukan admin di halaman Otomasi.

## 3. Belum bisa / diblokir
- **Campaign master** tidak ada (hanya Campaign ID di kartu, dan isian itu sudah disembunyikan dari Detail kartu). Workflow D selalu Needs Configuration.
- **Analitik Meta/Instagram** tidak terhubung: workflow E hanya mengingatkan mencatat metrik manual di tab CPR; tidak ada angka otomatis.
- "Create Task" terpisah tidak dibuat: di Studio kartu = tugas; node Assign Owner mengisi PIC kartu yang kosong.
- Persetujuan diputuskan di Detail kartu Studio (aturan & izin yang sama); Approval Inbox menautkan ke sana, tidak punya tombol keputusan sendiri.
- Kunci keputusan bersamaan berlaku untuk satu proses server (kondisi sekarang).

## 4. Bukti uji
- `node --import tsx --test src/server/automation/*.test.ts src/server/studio/*.test.ts` → 64 lulus.
- `npm test` seluruh repo: 3 gagal yang **sudah gagal sebelum perubahan ini** (jumlah role, shift-default, WA pagi).
- `next build`: kompilasi + TypeScript + 96 halaman lolos (termasuk `/media/otomasi`); Next.js menampilkan peringatan keamanan versi (perlu upgrade terpisah).
- Migrasi diuji di PostgreSQL (pglite): 10 tabel, klaim timer atomik, dedupe event.

## 5. Deploy & rollback
1. Merge PR → Deploy PC otomatis menjalankan migrasi (hanya tabel baru).
2. Buka Studio › **Otomasi** › Konfigurasi, aktifkan aturan yang disetujui.
3. Terbitkan workflow di Builder (Test Run dulu dengan kartu nyata).
4. Tekan **Nyalakan worker** di halaman Otomasi (admin penuh). Tidak ada langkah manual di PC kantor.

Rollback: **Matikan worker** (semua otomasi berhenti; event tetap dicatat), Disable workflow tertentu dari Builder, atau revert PR (tabel baru boleh dibiarkan, tidak dipakai bagian lain).
