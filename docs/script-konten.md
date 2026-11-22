# Script Konten (22 Nov 2026)

Editor script ala Google Docs untuk **Video review (`vrv`) dan Video event (`evt`)** yang punya Content ID (`MediaTask.cprId`).
Dibuka dari Studio (menu Script Konten, tombol di kartu FlowSpace, tautan di CPR) dan dari `/media/script` — semuanya membuka dokumen yang sama (`ScriptDoc.taskId` unik).

## Aturan (keputusan Zaki, 22 Nov 2026)
- Menulis/mengedit: semua anggota media.
- Creative Review script: diajukan siapa pun; disetujui / diminta revisi oleh admin atau Admin 2 yang **bukan penulisnya** (`writers`). Admin penuh boleh menyetujui script yang ia tulis dengan alasan (tercatat).
- Status script tidak menahan tahap FlowSpace.
- Script baru diawali foto barang utama; foto lain dari folder barang/kartu (hanya yang boleh dilihat pengguna).

## Data (migrasi `20261122180000_script_konten`, hanya tabel baru)
`ScriptDoc` (isi JSON Tiptap, `version` untuk cek bentrok, status, `submittedRev`, `approvedRev`, `writers`), `ScriptRevision` (dibuat saat dibuat/diajukan/dipulihkan, dan saat simpan bila versi terakhir >15 menit atau dari orang lain), `ScriptComment`, `ScriptReview`.
Rollback: hapus keempat tabel (tidak ada tabel lama yang berubah). Menghapus kartu tidak menghapus script.

## Keamanan
- Isi disimpan sebagai JSON, tidak pernah HTML mentah; server memvalidasi jenis blok, format, link (http/https/mailto), gambar (hanya `/api/file?key=` dengan rujukan `item:`/`asset:`), font, dan nilai gaya.
- Semua aksi lewat server action dengan `requireMedia`; keputusan review & komentar dicek di server (`src/lib/media/script.ts`, diuji).
- Simpan memakai nomor versi: bila orang lain menyimpan lebih dulu, simpanan ditolak dan pengguna memilih memuat versi terbaru atau tetap menyimpan versinya.

## Belum dibuat (usulan)
- **Edit bersamaan real-time** (kursor bersama): butuh Yjs + server WebSocket (mis. Hocuspocus) di PC kantor. Sekarang: cek perubahan tiap 15 detik + pencegahan tumpang tindih saat simpan.
- **Impor Google Docs / DOCX**: perlu Google Docs API (akun layanan + izin per dokumen) atau unggah .docx dan konversi (mammoth). Format/komentar tidak dijamin sama. Sementara link Google Docs lama tetap ditampilkan.
- **Tampilan AV Script** (scene/timecode/visual/audio): ditunda supaya tidak ada dua isi yang bisa berbeda.
- Unggah foto langsung dari editor: sekarang foto diunggah lewat halaman File (folder barang/kartu), lalu dipilih di editor.
