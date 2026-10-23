# ARCHITECTURE — Sistem Manajemen Internal Tirtonic

Acuan: `PRD.md` v0.1. Dokumen ini untuk disetujui bersama PRD sebelum Fase 0.
Stack: Next.js (App Router) + TypeScript · Tailwind v4 + shadcn/ui · PostgreSQL + Prisma ·
Better Auth (OTP kustom via WAHA) · `@aws-sdk/client-s3` → MinIO · Docker · GitHub Actions.

---

## 1. Diagram arsitektur

```
                            Internet (HTTPS)
                                  │
                    ┌─────────────┴──────────────┐
                    │   Cloudflare (DNS + proxy)  │
                    │   app.tirtonic.com (TBD §11.7)
                    └─────────────┬──────────────┘
                                  │
        ┌─────────────────────────────────────────────────────┐
        │  VPS kantor (Docker Compose)                         │
        │                                                      │
        │   ┌──────────────┐   internal network                │
        │   │  Caddy/Nginx │  (reverse proxy + TLS)            │
        │   └──────┬───────┘                                   │
        │          │                                           │
        │   ┌──────▼───────┐    ┌──────────────┐  ┌─────────┐ │
        │   │  Next.js app │───▶│  PostgreSQL  │  │  n8n    │ │
        │   │ (server+API) │    │  (+volume)   │  │(webhook)│ │
        │   └──┬───────┬───┘    └──────┬───────┘  └────┬────┘ │
        │      │       │               │               │      │
        │      │       │          pg_dump backup   API only   │
        │      │       │               │          (tulis lewat │
        │      │   ┌───▼────┐          │           app, bukan  │
        │      │   │  WAHA  │          │           DB langsung)│
        │      │   │ (OTP + │          │               │      │
        │      │   │  WA)   │          │               │      │
        │      │   └────────┘          │               │      │
        └──────┼──────────────────────┼───────────────┼──────┘
               │ S3 API               │ dump dikirim  │
               │ (presigned URL)      ▼               │
        ┌──────▼───────────────────────────────┐      │
        │  PC server kantor                     │      │
        │  (via Cloudflare Tunnel / Tailscale)  │◀─────┘
        │   ┌─────────┐   ┌──────────────────┐  │
        │   │  MinIO  │   │ backup DB (dump) │  │
        │   │ (S3)    │   └──────────────────┘  │
        │   └─────────┘                         │
        └───────────────────────────────────────┘

Klien: browser HP/laptop (PWA) → HTTPS → Next.js.
Kamera & GPS hanya jalan di HTTPS.
```

**Prinsip jaringan**
- Hanya Next.js yang terekspos publik (via proxy). PostgreSQL, WAHA, n8n **tidak** publik — hanya di network internal Docker.
- MinIO & backup di PC kantor diakses VPS lewat **Cloudflare Tunnel atau Tailscale** (tidak membuka port publik). Klien tidak akses MinIO langsung; selalu lewat **presigned URL** berumur pendek dari app.
- n8n **tidak pernah** menulis DB langsung — hanya lewat API app (webhook ber-secret).
- **OTP: app → webhook n8n ber-secret → node WAHA.** ⚠️ Workflow OTP di n8n **wajib** matikan penyimpanan eksekusi (Save successful/failed/manual executions = *off*) agar kode OTP tak tersimpan di log n8n (PRD §5.3). App hanya log status, bukan kode. Fallback: email bila WA gagal.

---

## 2. Struktur folder

```
tirtonichub/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/                 # tanpa shell dashboard
│  │  │  ├─ login/               # input email
│  │  │  ├─ otp/                 # input OTP
│  │  │  └─ pilih-role/
│  │  ├─ (dash)/                 # layout shell (sidebar/header/panel/bottomnav)
│  │  │  ├─ layout.tsx
│  │  │  ├─ beranda/             # landing per role aktif
│  │  │  ├─ absen/               # kamera + lokasi
│  │  │  ├─ riwayat-absen/
│  │  │  ├─ pengajuan/           # list + form + detail
│  │  │  ├─ profil/
│  │  │  ├─ notifikasi/
│  │  │  └─ hr/                  # modul HR (dilindungi RBAC)
│  │  │     ├─ karyawan/
│  │  │     ├─ cabang/
│  │  │     ├─ jadwal/
│  │  │     ├─ hari-libur/
│  │  │     ├─ rekap/            # harian + bulanan + export
│  │  │     ├─ approval/
│  │  │     ├─ log/
│  │  │     └─ sesi/
│  │  ├─ api/
│  │  │  ├─ auth/                # login, verify-otp, resend, logout (Better Auth + kustom)
│  │  │  └─ webhooks/n8n/        # ber-secret
│  │  ├─ manifest.ts             # PWA
│  │  └─ globals.css             # token dari DESIGN_TOKENS.md
│  ├─ server/
│  │  ├─ auth/                   # better-auth config, otp, session, rbac
│  │  │  ├─ rbac.ts              # permission matrix + guard
│  │  │  ├─ otp.ts               # generate/hash/verify
│  │  │  └─ session.ts
│  │  ├─ services/               # employee, attendance, request, branch, schedule…
│  │  ├─ actions/                # Server Actions (mutasi) — semua lewat rbac guard
│  │  ├─ db.ts                   # Prisma client (singleton)
│  │  ├─ waha.ts                 # HTTP client WAHA
│  │  ├─ storage.ts             # S3/MinIO: upload, presign
│  │  ├─ activity-log.ts         # pencatat log (before/after)
│  │  └─ time.ts                 # util WIB/UTC
│  ├─ components/
│  │  ├─ ui/                     # shadcn
│  │  ├─ layout/                 # sidebar, header, right-panel, bottom-nav
│  │  └─ shared/                 # kartu KPI, tabel+badge, empty/loading/error state
│  ├─ lib/                       # zod schemas, format, konstanta role
│  └─ types/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts                    # 8 role, Boss (env), 3 cabang
├─ public/                       # ikon PWA, sw
├─ docker-compose.yml            # app, postgres, waha, n8n, proxy
├─ Dockerfile
├─ .github/workflows/deploy.yml
├─ .env.example
├─ DESIGN_TOKENS.md
├─ ARCHITECTURE.md
└─ PRD.md
```

---

## 3. Auth: OTP + role aktif di sesi

### 3.1 Alur (server-authoritative)

```
POST /api/auth/login { email }
  → validasi domain (ALLOWED_EMAIL_DOMAINS) + Zod
  → cari user aktif  (jawaban SELALU generik, tak bocorkan email terdaftar/tidak)
  → rate limit per IP + per email
  → buat OtpChallenge: code 6 digit, simpan codeHash (argon2/bcrypt), expiresAt +5m
  → POST webhook n8n (secret) { waNumber, code } → n8n node WAHA kirim WA
        (workflow OTP n8n: penyimpanan eksekusi OFF; app tak log kode)
      gagal → fallback kirim OTP ke email (SMTP)
  → respon generik "OTP dikirim jika email valid"

POST /api/auth/verify { email, code }
  → ambil OtpChallenge terbaru, cek: expiresAt, consumedAt null, lockedUntil null
  → attempts++; cocokkan hash
      salah → attempts>=5 → lockedUntil +15m
      benar → consumedAt=now
  → buat Session { userId, tokenHash, activeRoleCode=null, expiresAt +7d (SESSION_TTL_DAYS) }
  → set cookie httpOnly/secure/sameSite=lax
  → roles = user.roles
      len==1 → set activeRoleCode, redirect /beranda
      len>1  → redirect /pilih-role

POST /api/auth/select-role { roleCode }
  → pastikan roleCode ∈ user.roles → Session.activeRoleCode = roleCode
```

**Ganti role** (dari header): endpoint sama `select-role`, tanpa login ulang.
**OTP resend**: max 3/sesi login, jeda ≥60 detik (`resendCount`, cek `createdAt`).
**Kirim ulang pesan WA**: kode + masa berlaku + "jangan bagikan kode ini".

### 3.2 Role aktif

- `Session.activeRoleCode` adalah **satu-satunya sumber kebenaran** peran yang sedang dipakai.
- Setiap request server membaca sesi → `{ userId, activeRole, allRoles }`.
- Kewajiban absen = properti **orang**: wajib jika punya ≥1 role selain `BOSS`. Akun hanya-`BOSS` tak absen. Dicek dari `allRoles`, bukan `activeRole`.

### 3.3 Better Auth

Better Auth mengelola session store (di DB) + cookie. Alur OTP WAHA dibuat **kustom**
(plugin/credential flow): generate → kirim WAHA → verify. Password tidak dipakai.
`Session` diperluas dengan kolom `activeRoleCode` (lihat skema PRD §14).

---

## 4. RBAC — pengecekan izin di server

**Aturan: semua izin dicek di server. UI hanya menyembunyikan, tidak mengamankan.**

### 4.1 Guard terpusat

```ts
// server/auth/rbac.ts
type Ctx = { userId: string; activeRole: RoleCode; allRoles: RoleCode[] };

const can = {
  manageEmployees: (c) => c.activeRole === 'BOSS' || c.activeRole === 'HR',
  assignRole: (c, target: RoleCode, selfId: string, targetUserId: string) => {
    if (c.activeRole === 'BOSS') return true;                 // Boss: semua
    if (c.activeRole !== 'HR') return false;
    if (target === 'BOSS' || target === 'HR') return false;   // HR tak boleh Boss/HR
    if (targetUserId === selfId) return false;                // tak boleh akun sendiri
    return true;
  },
  approveRequest: (c) => c.activeRole === 'BOSS' || c.activeRole === 'HR',
  viewAllAttendance: (c) => c.activeRole === 'BOSS' || c.activeRole === 'HR'
                             || (c.activeRole === 'HEAD_BRANCH' && FLAG_HEAD_BRANCH_READ), // §11.1
  // ...
};

function requireActiveRole() { /* baca sesi, 401 jika tak ada */ }
function authorize(check: boolean) { if (!check) throw new Forbidden(); }
```

- **Semua Server Action & route mutasi** memanggil `requireActiveRole()` lalu `authorize(can.X(ctx, …))` sebagai baris pertama — root-cause guard, bukan ditempel per tombol.
- **Invariant server (bukan sekadar cek peran):**
  - Boss terakhir aktif tak boleh dicabut/dinonaktifkan → cek `count(active BOSS) > 1` dalam **transaksi**.
  - Menonaktifkan akun → revoke semua `Session` miliknya (satu transaksi).
  - `Attendance` unik `userId+date`; absen pakai **jam server** (bukan jam HP).
- Setiap mutasi menulis `ActivityLog` (actor, actorRole aktif, before/after, ip) di transaksi yang sama.

### 4.2 Validasi input

Zod di batas server untuk setiap action/route. Tak ada data sensitif di URL (PRD §16).

---

## 5. Penyimpanan file (MinIO)

- `server/storage.ts` pakai `@aws-sdk/client-s3`, endpoint = MinIO (env), `forcePathStyle: true`.
- Upload foto absen/avatar/lampiran: client kompres dulu (≤1280px, JPEG ~0.7, <300KB) → kirim ke server action → server `PutObject` → simpan **key** di DB.
- Baca file: server buat **presigned GET URL** umur pendek (mis. 5 menit); klien tak pernah pegang kredensial MinIO.
- Pindah ke Cloudflare R2 = cukup ganti env (endpoint/keys), kode sama.

---

## 6. Waktu (WIB)

- Semua timestamp disimpan **UTC** di DB.
- Tampilan & perhitungan "hari absen" pakai **Asia/Jakarta**. Util `server/time.ts` (mis. `dateKeyWIB(d)` → `YYYY-MM-DD` WIB) dipakai untuk `Attendance.date` dan rekap, agar batas hari konsisten.
- Status terlambat = `checkInAt` (WIB) vs `WorkSchedule.startTime` + `lateToleranceMin`.

**Aturan domain tambahan (dari keputusan §11):**
- **Radius absen**: tolak hanya bila `haversine(lokasi, cabang) − akurasiGPS > ATTENDANCE_RADIUS_METERS` (50 m). Toleransi akurasi mencegah absen sah tertolak.
- **Kuota cuti**: 12 hari/tahun, hanya jika `now − User.joinedAt ≥ 1 tahun`; sisa = 12 − cuti `APPROVED` tahun berjalan (type `LEAVE`). Masa kerja < 1 tahun → kuota 0.
- **Koreksi absen**: approval koreksi menimpa `Attendance` hari itu **persis** sesuai `Request.payload` (buat baris bila belum ada), dalam transaksi + `ActivityLog`.
- **Boss**: tak pernah punya `Attendance` (tak merangkap role lain).

---

## 7. Real-time (Fase 3 — chat)

Rekomendasi: **SSE** untuk notifikasi in-app (satu arah, cukup untuk badge/status baca),
dan **WebSocket** untuk chat (dua arah, typing/read receipt).

- Fase 1–2: notifikasi in-app boleh **polling ringan** atau SSE sederhana — tak perlu WS dulu (YAGNI).
- Fase 3: WebSocket. Karena self-host Docker, opsi:
  - **a)** WS native di proses Next.js (custom server) — paling simpel, 1 instance.
  - **b)** Layanan WS terpisah (mis. `ws`/Socket.IO service) di compose, broadcast via Postgres `LISTEN/NOTIFY` atau Redis pub/sub bila scale.
- Dengan ±27 user & 1 instance, **(a) + Postgres LISTEN/NOTIFY** cukup. Redis hanya jika nanti multi-instance.
- Keputusan final WS vs SSE untuk chat dikonfirmasi saat mulai Fase 3.

---

## 8. Environment variables

```
# App
NODE_ENV=production
APP_URL=https://tirtonichub.com              # tanpa subdomain (§11.7)
ALLOWED_EMAIL_DOMAINS=tirtonichub.com         # §11.6
SESSION_TTL_DAYS=7                            # §5.5
BETTER_AUTH_SECRET=                           # random panjang

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/tirtonichub

# OTP via n8n (node WAHA di dalam n8n; kredensial WAHA ada di n8n, bukan app)
N8N_OTP_WEBHOOK_URL=http://n8n:5678/webhook/otp
N8N_OTP_WEBHOOK_SECRET=
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_LOCK_MINUTES=15
OTP_MAX_RESEND=3
OTP_RESEND_COOLDOWN_SEC=60

# Fallback OTP via email (§11.4)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Storage (MinIO / R2-compatible)
S3_ENDPOINT=http://minio:9000                 # atau URL tunnel ke PC kantor
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=tirtonic
S3_FORCE_PATH_STYLE=true
S3_PRESIGN_TTL_SEC=300

# Seed 2 Boss (§5.4 — recovery)
SEED_BOSS1_EMAIL=
SEED_BOSS1_NAME=
SEED_BOSS1_WA=+62...                           # E.164
SEED_BOSS2_EMAIL=
SEED_BOSS2_NAME=
SEED_BOSS2_WA=+62...

# n8n (fase lanjut)
N8N_WEBHOOK_SECRET=

# Absen (§11.2) — tolak bila di luar radius, dengan toleransi akurasi GPS
ATTENDANCE_RADIUS_METERS=50
```

`.env.example` berisi semua kunci di atas tanpa nilai rahasia.

---

## 9. Deploy (Docker + GitHub Actions)

### 9.1 docker-compose (VPS)
Services: `app` (Next.js), `postgres` (+volume), `waha`, `n8n`, `proxy` (Caddy/Nginx TLS).
MinIO berjalan di **PC kantor**, dihubungkan via Cloudflare Tunnel/Tailscale (bukan di compose VPS).

### 9.2 Pipeline (`push ke main`)
```
1. lint + typecheck + test (gagal → stop)
2. prisma generate; build Next.js standalone
3. docker build → push image ke registry (GHCR)
4. SSH ke VPS → docker compose pull app → prisma migrate deploy → compose up -d app
5. healthcheck /api/health → rollback image lama bila gagal
```
- **Migrasi**: `prisma migrate deploy` saat deploy (bukan `db push`).
- **Backup DB**: cron `pg_dump` → kirim ke PC kantor (tunnel). Dijadwalkan di VPS/n8n.
- **Secret**: GitHub Actions Secrets untuk SSH + registry; `.env` produksi hanya di VPS.
- **Zero-ish downtime**: 1 instance → singkat saat restart; cukup untuk internal ±27 user.

---

## 10. Keputusan terkunci (PRD §11)

Semua sudah diputuskan: Head Branch tak lihat absen (hanya HR/Boss); radius absen tolak >50 m
(toleransi akurasi); tanpa subdomain (`tirtonichub.com`); domain `tirtonichub.com`; OTP via
n8n→WAHA (logging eksekusi OFF) + fallback email (SMTP env); 2 akun Boss seed; export `.xlsx`;
cuti 12/thn untuk masa kerja ≥1thn (`User.joinedAt`); Boss tanpa role lain. Siap Fase 0.
