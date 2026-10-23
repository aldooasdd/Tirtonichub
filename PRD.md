# PRD — Sistem Manajemen Internal Tirtonic

Versi: 0.1 (draft untuk disetujui)
Tanggal: 23 Oktober 2026
Pemilik: Aldo

---

## 1. Ringkasan

Web aplikasi internal untuk karyawan Tirtonic (±27 orang, 3 cabang). Satu aplikasi dan satu database. Akses dibedakan lewat role (RBAC). Setiap karyawan login dengan email domain kantor dan OTP via WhatsApp. Setelah login, karyawan memilih role yang ingin dipakai (satu akun bisa punya beberapa role), lalu masuk ke dashboard role tersebut.

**Fokus fase ini: Login + Modul HR + Absensi.** Modul divisi lain (tugas harian, KPI per role, stok, keuangan, dll.) dibahas terpisah nanti.

---

## 2. Tujuan

1. Karyawan bisa login aman tanpa password (email + OTP WA).
2. HR bisa mengelola akun, role, cabang, dan jam kerja tanpa bantuan teknis.
3. Karyawan bisa absen dari HP/laptop dengan foto + lokasi.
4. HR menerima rekap absen harian di dashboard, serta memproses pengajuan cuti/izin/sakit.
5. Fondasi UI (layout, tema light/dark, komponen) siap dipakai modul berikutnya.

### Di luar ruang lingkup fase ini
- Isi KPI kinerja per role dan tugas harian per role (hanya disiapkan tempat/placeholder).
- Modul stok, penjualan, keuangan, media, order.
- Forum chat (dikerjakan fase 3, spesifikasi sudah ditulis di bagian 10).
- Pendaftaran perangkat (dihapus dari rencana).

---

## 3. Role

| # | Role | Kode | Absen? | Catatan |
|---|---|---|---|---|
| 1 | Boss | `BOSS` | Tidak | Akses penuh. Satu-satunya yang bisa memberi/mencabut role Boss dan HR. |
| 2 | Media | `MEDIA` | Ya | |
| 3 | Finance | `FINANCE` | Ya | |
| 4 | Stok Room | `STOCK_ROOM` | Ya | |
| 5 | Human Resource | `HR` | Ya | Kelola akun, role (kecuali Boss & HR), cabang, jam kerja, absensi, pengajuan. |
| 6 | Head Branch | `HEAD_BRANCH` | Ya | Bisa melihat data semua cabang (3 cabang). |
| 7 | Sales | `SALES` | Ya | |
| 8 | Order Specialist | `ORDER_SPECIALIST` | Ya | |

### Aturan multi-role
- Satu akun bisa punya **1 atau lebih role**, tanpa batas maksimal.
- Setelah login, user memilih **role aktif**. Menu, data, dan izin mengikuti role aktif.
- User bisa **ganti role aktif** dari header tanpa login ulang.
- Kalau user hanya punya 1 role, layar pilih role dilewati.
- Kewajiban absen melekat pada **orang**, bukan role. Karyawan wajib absen jika punya minimal satu role selain Boss. Akun yang hanya punya role Boss tidak absen.
- **Boss tidak merangkap role lain** (role Boss berdiri sendiri) → Boss tidak pernah absen.

### Aturan pengaturan role (anti eskalasi akses)
- **HR** boleh memberi/mencabut role: Media, Finance, Stok Room, Head Branch, Sales, Order Specialist.
- **HR tidak boleh**: memberi/mencabut role Boss atau HR, dan tidak boleh mengubah role di akunnya sendiri.
- **Boss** boleh memberi/mencabut semua role, termasuk Boss dan HR.
- Sistem wajib selalu punya **minimal 1 akun Boss aktif**. Mencabut/menonaktifkan Boss terakhir ditolak.
- Semua aturan ini divalidasi di **server**, bukan hanya disembunyikan di UI.

---

## 4. Matriks hak akses (fase ini)

| Aksi | Boss | HR | Head Branch | Role lain |
|---|---|---|---|---|
| Login, pilih/ganti role, edit profil sendiri | ✅ | ✅ | ✅ | ✅ |
| Absen masuk/pulang | — | ✅ | ✅ | ✅ |
| Ajukan cuti/izin/sakit/koreksi absen | — | ✅ | ✅ | ✅ |
| Lihat riwayat absen sendiri | — | ✅ | ✅ | ✅ |
| Buat / edit / nonaktifkan akun | ✅ | ✅ | ❌ | ❌ |
| Atur role (selain Boss & HR) | ✅ | ✅ (bukan akun sendiri) | ❌ | ❌ |
| Atur role Boss & HR | ✅ | ❌ | ❌ | ❌ |
| Kelola cabang & jam kerja | ✅ | ✅ | ❌ | ❌ |
| Lihat rekap absen semua karyawan | ✅ | ✅ | ⚠️ lihat 11.1 | ❌ |
| Setujui/tolak pengajuan | ✅ | ✅ | ❌ | ❌ |
| Lihat log aktivitas seluruh sistem | ✅ | ✅ (modul HR) | ❌ | ❌ |
| Lihat & cabut sesi aktif user lain | ✅ | ✅ | ❌ | ❌ |

---

## 5. Login & keamanan

### 5.1 Alur login
```
[Layar Login] masukkan email (@domain Tirtonic)
   → server cek: format domain benar? email terdaftar? akun aktif?
     (pesan error dibuat umum, tidak membocorkan apakah email terdaftar)
   → buat OTP 6 digit → kirim ke nomor WA milik akun via WAHA
[Layar OTP] masukkan kode
   → valid → buat sesi
   → jumlah role = 1 → langsung ke dashboard role itu
     jumlah role > 1 → [Layar Pilih Role] → dashboard role terpilih
```

### 5.2 Aturan OTP
- 6 digit angka, berlaku **5 menit**, **sekali pakai**.
- Disimpan sebagai **hash**, tidak pernah disimpan dalam bentuk asli.
- Maksimal **3 kali kirim ulang** per sesi login, dengan jeda minimal 60 detik.
- Maksimal **5 kali salah**, lalu email dikunci sementara **15 menit**.
- Rate limit per IP dan per email di endpoint kirim OTP.
- Isi pesan WA: kode, masa berlaku, dan peringatan "jangan bagikan kode ini".

### 5.3 Pengiriman OTP
- Dikirim dari aplikasi ke **webhook n8n ber-secret** → n8n memanggil **node WAHA** untuk kirim WA. (Keputusan Aldo: reuse pipeline WA yang sudah ada di n8n.)
- **WAJIB keamanan:** workflow OTP di n8n harus **mematikan penyimpanan data eksekusi** (Settings workflow → Save successful/failed/manual executions = *off*). Tanpa ini, kode OTP tersimpan di riwayat eksekusi n8n dan bisa dibaca siapa pun yang punya akses n8n.
- App **tidak** mengirim kode ke log-nya sendiri; hanya status sukses/gagal.
- Kalau gagal kirim WA: tampilkan "OTP gagal terkirim, coba lagi / hubungi HR", catat error (tanpa kode), dan **fallback kirim OTP ke email** (§11.4).
- Nomor WA pengirim = nomor khusus sistem.

### 5.4 Akun & domain
- Hanya email dengan domain yang diizinkan (env `ALLOWED_EMAIL_DOMAINS`) yang bisa login.
- **Pendaftaran mandiri dimatikan.** Akun hanya dibuat oleh HR atau Boss.
- Setiap akun **wajib** punya: nama lengkap, email domain, nomor WA (format E.164, contoh `+628xxxx`), minimal 1 role.
- **2 akun Boss** dibuat lewat **seed** saat instalasi (env `SEED_BOSS1_*` dan `SEED_BOSS2_*`: email, nama, WA). Dua Boss agar bila satu kehilangan WA, Boss lain memulihkan. Boss lalu membuat akun HR.
- Akun tidak pernah dihapus, hanya **dinonaktifkan**. Menonaktifkan akun langsung mencabut semua sesinya.

### 5.5 Sesi
- Sesi disimpan di database (bisa dicabut).
- Durasi default **7 hari**, diperpanjang otomatis saat aktif (nilai bisa diatur di env).
- Role aktif disimpan di sesi.
- HR/Boss bisa melihat daftar sesi aktif per user (perangkat/browser, IP, waktu terakhir aktif) dan mencabutnya.
- Fitur perangkat terdaftar **tidak** dipakai.

---

## 6. Struktur dashboard

### 6.1 Layout (mengikuti Figma SnowUI)
- **Desktop**: sidebar kiri (menu sesuai role aktif) + header (breadcrumb, pencarian, tombol tema, notifikasi, ganti role, avatar) + konten + panel kanan (notifikasi & aktivitas, bisa disembunyikan).
- **HP**: sidebar diganti **bottom navigation** (Beranda, Absen, Pengajuan, Notifikasi, Profil), grid kartu menjadi 2 kolom, semua blok ditumpuk 1 kolom.
- **Mode light & dark**: toggle di header, default mengikuti sistem, pilihan tersimpan per user.
- Aplikasi bisa diinstal sebagai **PWA** di HP.

### 6.2 Landing page role selain Boss
Urutan blok:
1. **Overview kinerja saya**: 4 kartu KPI. Isinya per role akan ditentukan nanti. Fase ini: placeholder + data absensi sendiri (hari hadir bulan ini, jumlah terlambat, sisa cuti*, pengajuan pending).
2. **Kartu Absen**: status hari ini (belum absen / sudah masuk jam X / sudah pulang jam Y), jam kerja hari ini, tombol **Absen Masuk** / **Absen Pulang**.
3. **Tugas harian**: daftar tugas sesuai role aktif. Fase ini: komponen list + empty state "Belum ada tugas". Logika tugas menyusul.

\* tergantung keputusan terbuka 11.3.

### 6.3 Landing page HR
Sama seperti 6.2 (HR juga absen), ditambah blok:
- Ringkasan absen hari ini: Hadir, Terlambat, Belum absen, Izin/Cuti/Sakit (filter per cabang).
- Pengajuan yang menunggu persetujuan.

### 6.4 Landing page Boss
Tanpa kartu absen. Fase ini: ringkasan perusahaan yang tersedia (absensi hari ini semua cabang, pengajuan pending, jumlah karyawan aktif per cabang). Isi lengkapnya dibahas nanti.

### 6.5 Fitur umum (semua role)
- Profil (bagian 9), tema light/dark, notifikasi in-app, ganti role, logout.
- Forum chat (fase 3).

---

## 7. Modul HR

### 7.1 Manajemen karyawan
- Daftar karyawan: tabel (desktop) / list kartu (HP). Kolom: foto, nama, email, WA, role (badge), cabang, status (Aktif/Nonaktif).
- Filter: role, cabang, status. Pencarian nama/email.
- **Tambah karyawan**: nama lengkap, email, nomor WA, cabang, role (multi-select), jadwal kerja.
- **Edit karyawan**: semua field di atas. Email dan WA hanya bisa diubah HR/Boss.
- **Nonaktifkan / aktifkan kembali** (dengan konfirmasi).
- **Detail karyawan**: tab Info, Role, Riwayat Absen, Pengajuan, Sesi Aktif, Log Aktivitas.

### 7.2 Manajemen role
- Diatur dari form karyawan (multi-select role), mengikuti aturan bagian 3.
- Role yang tidak boleh diatur oleh user saat ini ditampilkan **disabled** dengan keterangan.

### 7.3 Cabang
- CRUD cabang: nama, alamat, koordinat (opsional, untuk keperluan peta).
- Data awal: 3 cabang — **Tirtonic Jogja, Tirtonic Solo, Tirtonic Semarang** (diisi saat seed).

### 7.4 Jadwal kerja
- HR membuat **jadwal kerja** bernama, contoh: "Reguler 09:00–17:00", "Shift Pagi", "Shift Siang".
- Field: nama, hari kerja (Sen–Min), jam masuk, jam pulang, toleransi terlambat (menit).
- Setiap karyawan di-assign ke **satu jadwal kerja**. Perubahan jadwal berlaku mulai tanggal tertentu, dan riwayat lama tidak berubah.
- Hari libur nasional/kantor: HR bisa menandai tanggal libur (karyawan tidak dihitung "tidak hadir").

### 7.5 Rekap absen harian (dashboard HR)
- Halaman **Rekap Absen**: pilih tanggal (default hari ini), filter cabang.
- Ringkasan: Hadir tepat waktu, Terlambat, Belum/Tidak absen, Izin, Sakit, Cuti, Libur.
- Tabel per karyawan: jam masuk, jam pulang, durasi kerja, status, foto (thumbnail, bisa diperbesar), lokasi (buka peta).
- Rekap **bulanan** per karyawan: total hadir, terlambat (kali & total menit), tidak hadir, izin/sakit/cuti, total jam kerja.
- Export **Excel (.xlsx)** (rekap harian & bulanan).
- Rekap hanya di **dashboard**, tanpa kiriman WA/email.

### 7.6 Pengajuan (cuti, izin, sakit, koreksi absen)
- Karyawan mengajukan dari dashboard-nya: jenis, tanggal mulai–selesai, alasan, lampiran (opsional; untuk sakit bisa foto surat dokter).
- **Koreksi absen** (lupa absen / salah) juga lewat pengajuan. Karyawan tidak bisa mengedit absen sendiri.
- Status: **Pending → Approved / Rejected**. Penolakan wajib ada catatan.
- HR/Boss menerima pengajuan di halaman **Pengajuan** (tabel + badge status, mengikuti komponen Figma).
- Karyawan mendapat notifikasi in-app saat status berubah.
- Pengajuan yang disetujui otomatis tercermin di rekap absen.
- Pengajuan bisa dibatalkan pengaju selama masih Pending.

### 7.7 Log aktivitas
- Semua perubahan data dicatat: siapa (user + role aktif), aksi, entitas, data sebelum/sesudah, waktu, IP.
- Halaman log dengan filter user, aksi, tanggal.
- Log tidak bisa diedit/dihapus dari aplikasi.

---

## 8. Absensi (sisi karyawan)

### 8.1 Alur absen
```
Tombol "Absen Masuk" di landing
  → minta izin kamera & lokasi
  → ambil foto (kamera depan) → kompres otomatis di browser
  → ambil koordinat GPS + akurasi
  → preview: foto + peta kecil lokasi → Kirim
  → server mencatat waktu (jam server, bukan jam HP), foto, lokasi
  → status dihitung terhadap jadwal kerja: Tepat waktu / Terlambat (X menit)
```
Absen pulang dengan alur yang sama.

### 8.2 Aturan
- **Foto wajib** dari kamera langsung (bukan upload dari galeri).
- **Kompresi otomatis** di browser sebelum upload: sisi terpanjang maks 1280 px, JPEG kualitas ±0,7, target < 300 KB.
- Foto disimpan di **MinIO** (S3-compatible), di database hanya disimpan key/path-nya.
- **Lokasi wajib**: latitude, longitude, akurasi (meter). Kalau izin lokasi ditolak, absen tidak bisa dikirim dan muncul petunjuk cara mengaktifkannya.
- Satu kali absen masuk dan satu kali absen pulang per hari kerja.
- Absen pulang tanpa absen masuk → harus lewat pengajuan koreksi.
- Lupa absen pulang → status "Tidak absen pulang", diperbaiki lewat koreksi.
- Validasi radius: absen **ditolak** bila di luar radius cabang (env `ATTENDANCE_RADIUS_METERS=50`). Implementasi menolak hanya bila `jarak − akurasiGPS > radius` (toleransi akurasi GPS), supaya absen sah tidak tertolak.

### 8.3 Riwayat absen saya
- Kalender/list bulanan: status per hari, jam masuk/pulang, durasi.
- Ringkasan bulan berjalan.

---

## 9. Profil

| Field | Diubah sendiri | Diubah HR/Boss |
|---|---|---|
| Foto profil (dikompres otomatis) | ✅ | ✅ |
| Nama panggilan | ✅ | ✅ |
| Bio singkat | ✅ | ✅ |
| Preferensi tema (light/dark/sistem) | ✅ | — |
| Nama lengkap | ❌ | ✅ |
| Email | ❌ | ✅ |
| Nomor WA | ❌ | ✅ |
| Role | ❌ | ✅ (sesuai aturan bagian 3) |
| Cabang, jadwal kerja | ❌ | ✅ |

---

## 10. Forum chat (fase 3)

- **Grup**: ruang obrolan berisi beberapa anggota (contoh: per divisi, per cabang, satu grup semua karyawan).
- **DM**: chat pribadi antar dua karyawan.
- Fitur dasar: kirim teks, kirim gambar (dikompres, disimpan di MinIO), status dibaca, indikator pesan belum dibaca, notifikasi in-app.
- Real-time (WebSocket/SSE, ditentukan di ARCHITECTURE.md).
- Pembuatan grup & tambah anggota: **hanya HR**.

---

## 11. Keputusan (sudah dijawab Aldo — 23 Okt 2026)

1. **Head Branch & absensi**: Head Branch **tidak** lihat rekap absen. Rekap absen hanya **HR & Boss**.
2. **Validasi lokasi absen**: absen **ditolak** bila di luar radius **50 m** dari cabang (dengan toleransi akurasi GPS, §8.2).
3. **Kuota cuti**: **12 hari/tahun**, hanya untuk karyawan masa kerja **≥ 1 tahun**. Butuh `joinedAt` per user. KPI "sisa cuti" = 12 − cuti terpakai tahun berjalan (0 bila masa kerja < 1 tahun).
4. **Fallback OTP**: **ya**, kirim OTP ke email bila WA gagal.
5. **Grup chat**: **hanya HR** yang buat grup & tambah anggota.
6. **Domain email**: `tirtonichub.com`. Boss juga pakai domain ini.
7. **Subdomain**: tidak pakai subdomain (aplikasi di domain utama / sesuai setup deploy).
8. **Cabang**: Tirtonic Jogja, Tirtonic Solo, Tirtonic Semarang.
9. **Pengiriman OTP**: **via n8n** (app → webhook n8n → node WAHA). Logging eksekusi n8n untuk workflow OTP **wajib dimatikan** (§5.3).
10. **Absen & Boss**: Boss tidak merangkap role lain → Boss tidak pernah absen.
11. **Koreksi absen**: approval mengisi/menimpa data absen hari itu **persis** sesuai yang diajukan karyawan.
12. **Recovery Boss**: disediakan **2 akun Boss** (seed). Jika satu kehilangan WA, Boss lain memulihkan.
13. **Export**: **Excel (.xlsx)**.
14. **WAHA**: pakai **node WAHA di dalam n8n** (unofficial). Risiko ban diterima; mitigasi: nomor khusus sistem + fallback email OTP.

---

## 12. Desain UI

Sumber: Figma `Project-Aldo`, halaman **Dashboard** (node `192:6531`), basis UI kit **SnowUI**.

| Frame | Node ID |
|---|---|
| Dashboard Overview (desktop light) | `2607:11367` |
| Dashboard Overview (varian lain, termasuk dark) | `2607:11413`, `2607:11414`, `2607:11415` |
| Dashboard App (HP) | `2607:11416`, `2607:11417` |
| Variables | `2607:19115` |
| Spacing, Size, Corner Radius | `2607:19155` |
| Colors | `2607:19216` |
| Text Styles | `2607:19405` |
| Effect Styles | `2607:19440` |
| Components | `2607:19466` |

### Token awal (dibaca dari frame desktop; lengkapi dari halaman Variables/Colors)
- **Font**: Inter. Skala: 12/16, 14/20, 24/36 (angka KPI). Bobot 400 & 600. Catatan desainer: font 12–18 line-height ±1,5×, font 24–64 line-height ±1,2×.
- **Warna dasar**: hitam dengan opacity 100/80/40/20/10/4% (teks & garis), Background/1 `#FFFFFF`, Background/2 `#F9F9FA`, Surface/3 `#00000005`.
- **Aksen**: kartu KPI `#E6F1FD` dan `#EDEEFC`, Secondary Blue `#33D1FF`, Cyan `#A0BCE8`, Mint `#6BE6D3`, Green `#71DD8C`, Purple `#B899EB`.
- **Spacing**: 4, 8, 12, 16, 20, 24, 28, 40, 80. **Radius**: 8 (komponen kecil), 16 (kartu/blok).
- Kartu tanpa border tebal/shadow, dibedakan lewat warna latar.

### Pemetaan komponen
| Elemen Figma | Dipakai untuk |
|---|---|
| Kartu angka (KPI) | Overview kinerja, ringkasan absen |
| Tabel + badge status | Daftar karyawan, pengajuan, rekap absen |
| Panel kanan Notifications/Activities | Notifikasi + log aktivitas |
| Versi HP + bottom nav | Tampilan HP / PWA |

### Aturan tambahan
- Angka & nominal **rata kanan** di tabel.
- Badge status: Pending (kuning), Approved (hijau), Rejected (merah), Aktif/Nonaktif.
- Setiap list punya **empty state**, **loading state**, dan **error state**.
- Bahasa UI: **Indonesia**.

---

## 13. Daftar layar (fase 1–2)

**Auth**: Login email · Input OTP · Pilih role
**Umum**: Landing (per role) · Profil saya · Notifikasi
**Absensi**: Absen masuk/pulang (kamera + lokasi) · Riwayat absen saya
**Pengajuan**: Daftar pengajuan saya · Form pengajuan · Detail pengajuan
**HR**: Daftar karyawan · Form tambah/edit karyawan · Detail karyawan (tab) · Cabang · Jadwal kerja · Hari libur · Rekap absen harian · Rekap absen bulanan · Pengajuan masuk (approval) · Log aktivitas
**Boss**: Landing ringkasan perusahaan (+ akses semua layar HR)

---

## 14. Skema database awal (entitas utama)

```
User            id, fullName, nickname, email (unique), waNumber (unique),
                avatarKey, bio, branchId, joinedAt (tgl mulai kerja, utk kuota cuti),
                isActive, themePref, createdAt, updatedAt
Role            id, code (BOSS|MEDIA|FINANCE|STOCK_ROOM|HR|HEAD_BRANCH|SALES|ORDER_SPECIALIST), name
UserRole        userId, roleId, assignedById, assignedAt          (PK: userId+roleId)
Session         id, userId, activeRoleCode, tokenHash, userAgent, ip,
                expiresAt, lastActiveAt, revokedAt
OtpChallenge    id, email, codeHash, expiresAt, attempts, resendCount,
                consumedAt, lockedUntil, ip, createdAt
Branch          id, name, address, latitude, longitude
WorkSchedule    id, name, workDays (int[]), startTime, endTime, lateToleranceMin
UserSchedule    id, userId, scheduleId, effectiveFrom
Holiday         id, date, name
Attendance      id, userId, date, branchId,
                checkInAt, checkInPhotoKey, checkInLat, checkInLng, checkInAccuracy,
                checkOutAt, checkOutPhotoKey, checkOutLat, checkOutLng, checkOutAccuracy,
                status (ON_TIME|LATE|ABSENT|LEAVE|SICK|PERMIT|HOLIDAY), lateMinutes
                (unique: userId+date)
Request         id, userId, type (LEAVE|PERMIT|SICK|ATTENDANCE_CORRECTION),
                startDate, endDate, reason, attachmentKey, payload (json, untuk koreksi),
                status (PENDING|APPROVED|REJECTED|CANCELLED),
                reviewedById, reviewedAt, reviewNote, createdAt
Notification    id, userId, type, title, body, link, readAt, createdAt
ActivityLog     id, actorId, actorRole, action, entity, entityId,
                before (json), after (json), ip, createdAt
-- fase 3 --
ChatRoom        id, type (GROUP|DM), name, createdById, createdAt
ChatMember      roomId, userId, lastReadAt, joinedAt
ChatMessage     id, roomId, senderId, body, attachmentKey, createdAt, editedAt, deletedAt
```

---

## 15. Integrasi

- **n8n + WAHA**: OTP dikirim app → webhook n8n ber-secret → node WAHA. Workflow OTP **wajib** matikan penyimpanan eksekusi (§5.3). n8n menulis data app hanya lewat API aplikasi.
- **MinIO**: foto absen, avatar, lampiran pengajuan, gambar chat. Pakai `@aws-sdk/client-s3` agar bisa pindah ke Cloudflare R2 hanya dengan mengganti env. Akses file lewat presigned URL berumur pendek.

---

## 16. Kebutuhan non-fungsional

- **Keamanan**: semua izin dicek di server · OTP di-hash · rate limit · cookie sesi `httpOnly`, `secure`, `sameSite=lax` · validasi input dengan Zod · tidak ada data sensitif di URL.
- **Zona waktu**: semua waktu disimpan UTC, ditampilkan **Asia/Jakarta (WIB)**. Perhitungan "hari" absen memakai WIB.
- **Performa**: halaman utama < 2 detik di 4G. Foto selalu dikompres.
- **Responsif**: 360 px (HP) sampai 1440 px+ (desktop).
- **PWA**: manifest + service worker; bisa diinstal; kamera & lokasi berjalan di HTTPS.
- **Aksesibilitas dasar**: kontras cukup di light & dark, target sentuh ≥ 44 px di HP.

---

## 17. Tech stack

Next.js (App Router) + TypeScript · Tailwind CSS + shadcn/ui · PostgreSQL + Prisma · **Sesi & OTP kustom (hand-rolled, tanpa library auth)**: cookie sesi di DB + OTP via n8n→WAHA · `@aws-sdk/client-s3` → MinIO · PWA · Docker + docker-compose di VPS · GitHub Actions (push ke `main` → build image → deploy).

Infrastruktur: VPS kantor (aplikasi + PostgreSQL + n8n + WAHA) · PC server kantor (MinIO + tujuan backup DB, diakses via Cloudflare Tunnel/Tailscale) · ±27 pengguna.

---

## 18. Fase pengerjaan

**Fase 0 — Fondasi**
Scaffold project, tema Tailwind + shadcn dari token Figma, layout shell (sidebar, header, panel kanan, bottom nav HP), light/dark, Prisma schema + seed (8 role, akun Boss, 3 cabang), Docker compose lokal.

**Fase 1 — Login & akun**
Login email + OTP WAHA, pilih/ganti role, sesi & logout, manajemen karyawan + role (dengan aturan anti eskalasi), cabang, profil, log aktivitas, daftar & cabut sesi.

**Fase 2 — Absensi & HR**
Jadwal kerja, hari libur, absen masuk/pulang (foto + lokasi + MinIO), riwayat absen saya, landing per role (KPI absensi + kartu absen + placeholder tugas), rekap harian & bulanan + export, pengajuan cuti/izin/sakit/koreksi + approval, notifikasi in-app, PWA.

**Fase 3 — Chat**
Grup + DM, real-time, notifikasi.

**Fase berikutnya** (dibahas terpisah)
KPI kinerja per role, tugas harian per role, modul Stok, Sales, Finance, Media, Order, integrasi n8n.

---

## 19. Kriteria selesai (fase 0–2)

- [ ] Boss hasil seed bisa login dengan email + OTP WA dan membuat akun HR.
- [ ] HR bisa membuat akun dengan 2+ role. User tersebut melihat layar pilih role dan bisa ganti role dari header.
- [ ] HR tidak bisa memberi role Boss/HR dan tidak bisa mengubah role sendiri (ditolak di server, dicek dengan test).
- [ ] Boss terakhir tidak bisa dinonaktifkan.
- [ ] OTP: kedaluwarsa 5 menit, sekali pakai, terkunci setelah 5 salah, maksimal 3 kirim ulang. Kode tidak tersimpan dalam bentuk asli.
- [ ] Karyawan bisa absen masuk/pulang dari HP dengan foto (< 300 KB) + lokasi. Status terlambat dihitung sesuai jadwal kerja.
- [ ] Boss tidak melihat tombol absen.
- [ ] HR melihat rekap harian dengan filter cabang dan bisa export.
- [ ] Pengajuan cuti/izin/sakit/koreksi bisa diajukan, disetujui/ditolak, dan tercermin di rekap.
- [ ] Semua perubahan data tercatat di log aktivitas.
- [ ] Tampilan sesuai Figma di light & dark, desktop & HP.
