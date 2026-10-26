# Pindah Media (Tirtonic Studio) ke Tirtonichub

UI Tirtonic Studio (dulu media.tirtonichub.com di Firebase) sekarang tersaji di **`/studio`**:
tampilan sama, tapi login, absen, akun, barang dari QC, foto, dan data memakai Tirtonichub.

## Cara kerja singkat
- `public/studio/` = UI (satu file `index.html`), dibuat dari repo `tirtonic-studio` dengan
  `python3 tools/build-hub.py <folder Tirtonichub>`. Jangan edit langsung di sini.
- `src/app/api/studio/*` = API untuk UI (me, sync, doc, write, lock, logout).
- `src/server/studio/rules.ts` = aturan akses (port dari firestore.rules; ada test).
- `src/server/studio/map.ts` = dokumen UI ⇄ tabel Media (MediaItem, MediaTask, MediaMember, …).
  Isian tanpa kolom disimpan di `extra` (JSON) supaya tidak ada yang hilang.
- Wajib absen hari ini sebelum membuka /studio, kecuali BOSS, hari libur pribadi
  (`MediaMember.offDays`, 0=Min…6=Sab), atau tanggal merah (`Holiday`).
- Menu sidebar Media → **Tirtonic Studio** membuka `/studio`.
- Barang yang lolos QC masuk sebagai "Dari QC · belum dijadwalkan"; admin menekan
  **Lengkapi & jadwalkan** di Daftar barang (kategori + kode Louis2) → konten Louis2 dibuat.

## Langkah pindah (di PC server)
1. Deploy branch ini seperti biasa (migrasi `20261026150000_studio_bridge` ikut `pnpm db:deploy`).
2. **Akun tim** di HR (email @tirtonichub.com + WA), peran **MEDIA**.
3. **Bekukan Firebase** (minta Zaki): tim berhenti mengubah data di media.tirtonichub.com.
4. **Ekspor** di laptop Zaki (repo tirtonic-studio):
   `python3 tools/export-firebase.py ekspor.json`
5. **Peta email** `peta.json`, contoh:
   ```json
   { "mzakiramadhan261003@gmail.com": "zaki@tirtonichub.com",
     "rayhanadinataputra13@gmail.com": "rayhan@tirtonichub.com",
     "ruminkvv@gmail.com": "aulia@tirtonichub.com",
     "aldo.assadad@gmail.com": "aldo@tirtonichub.com" }
   ```
6. **Coba dulu**: `docker compose exec web node --import tsx prisma/studio-import.mts ekspor.json peta.json --dry-run --admin zaki@tirtonichub.com`
7. **Impor**: perintah yang sama tanpa `--dry-run`. Aman diulang (upsert per dokumen).
8. Cek di `/studio` bersama tim (jumlah barang, kartu, foto, jadwal tayang).
9. Alihkan `media.tirtonichub.com` → `https://tirtonichub.com/studio` (Cloudflare redirect rule).
10. Setelah beberapa hari aman: simpan `ekspor.json` sebagai cadangan, lalu Firebase boleh dihapus.

Catatan: Aldo dulu admin dengan kode jobdesk **S** (milik Salma). Setelah impor, ubah di Tim & Aktivitas:
Aldo admin tanpa kode, Salma kode S (atau atur langsung di tabel MediaMember).
