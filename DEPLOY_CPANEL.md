# Deploy ke cPanel (Node.js App + PostgreSQL)

Host: cPanel Jupiter + CloudLinux (Passenger). DB: PostgreSQL cPanel.
Repo: `https://github.com/aldooasdd/Tirtonichub.git`. Entry Passenger: `server.js`.

File statis & foto (MinIO di PC kantor) diakses lewat URL publik/tunnel — set di env `S3_*`.

---

## 1. Buat database PostgreSQL

cPanel → **PostgreSQL Databases**:
1. Create Database → mis. `tirtonic_app` (cPanel kasih prefix, jadi `akun_tirtonic_app`).
2. Create User → mis. `tirtonic_user` + password kuat.
3. Add User To Database → centang **ALL PRIVILEGES**.

Catat: nama DB, user, password (pakai di `DATABASE_URL`).

## 2. Clone repo

cPanel → **Git™ Version Control** → Create:
- Clone URL: `https://github.com/aldooasdd/Tirtonichub.git`
- Repository Path: mis. `/home/akun/tirtonichub`
- (Repo privat → pakai Personal Access Token di URL, atau deploy key.)

## 3. Setup Node.js App

cPanel → **Setup Node.js App** → Create Application:
- **Node version**: ≥ 20 (pilih yang tertinggi, mis. 20/22).
- **Application mode**: Production.
- **Application root**: `tirtonichub` (folder repo di atas).
- **Application URL**: domain kamu (mis. `tirtonichub.com`).
- **Application startup file**: `server.js`.

Simpan. cPanel bikin virtualenv + kasih baris `source .../bin/activate` (dipakai di SSH).

### Environment variables (di panel Node App, bagian "Environment variables")
```
NODE_ENV=production
PRISMA_SKIP_POSTINSTALL_GENERATE=true
APP_URL=https://tirtonichub.com
ALLOWED_EMAIL_DOMAINS=tirtonichub.com
SESSION_TTL_DAYS=7
AUTH_SECRET=<acak panjang, mis. hasil: openssl rand -hex 32>
DATABASE_URL=postgresql://akun_tirtonic_user:PASSWORD@127.0.0.1:5432/akun_tirtonic_app
N8N_OTP_WEBHOOK_URL=https://n8n.tirtonic.com/webhook/tirtonic-otp
N8N_OTP_WEBHOOK_SECRET=<secret yang sama dgn workflow n8n>
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_LOCK_MINUTES=15
OTP_MAX_RESEND=3
OTP_RESEND_COOLDOWN_SEC=60
S3_ENDPOINT=<URL MinIO PC kantor, mis. https://img.tirtonic.com>
S3_REGION=us-east-1
S3_ACCESS_KEY=<minio access key>
S3_SECRET_KEY=<minio secret key>
S3_BUCKET=tirtonichub
```
(SMTP_* opsional — fallback email bila WA gagal.)

## 4. Install + seed (tanpa SSH, tanpa build)

Host ini **tidak bisa build**: `next build` dan `prisma generate` crash (WebAssembly out of memory, limit LVE). Karena itu:
- Hasil build `.next` sudah di-commit ke repo → host cukup menyajikannya, tidak build ulang.
- Prisma client sudah di-commit di `src/generated/prisma` → tidak perlu `prisma generate`. Env `PRISMA_SKIP_POSTINSTALL_GENERATE=true` mencegah `npm install` memicu generate (yang bikin crash).
- Skema DB sudah dimuat manual lewat phpPgAdmin → tidak perlu `prisma migrate deploy`.

Lewat panel **Setup Node.js App** (semua tombol, tanpa terminal):
1. **Run NPM Install** — download dependency (next, react, pg, @prisma/adapter-pg). Tidak build, aman.
2. **Restart** — Passenger jalankan `server.js`, app menyajikan `.next` yang sudah ada.
3. Buka domain → kalau halaman login muncul, serving OK.
4. Seed sekali (8 role, 2 Boss, 3 cabang): **Run JS script** → isi `prisma/seed.ts`... (lihat catatan di bawah).

> **Seed butuh tsx.** `Run JS script` cPanel jalankan `node <file>`, bukan tsx. Dua pilihan:
> - Jalankan seed **dari lokal** (mesin dev) dengan `DATABASE_URL` menunjuk ke DB cPanel — kalau port 5432 dibuka ke publik. Biasanya tidak.
> - Atau pakai **phpPgAdmin**: jalankan SQL seed manual (role, Boss, cabang). Minta file SQL seed ke sini bila perlu.

## 5. DNS

Arahkan `tirtonichub.com` (A record) ke IP server cPanel. SSL pakai **AutoSSL** cPanel (Let's Encrypt). HTTPS wajib untuk PWA + kamera + lokasi absen.

## 6. Update berikutnya

Build dilakukan **di lokal**, lalu commit `.next`:
```bash
# di mesin dev:
pnpm build
git add -A && git commit -m "deploy" && git push
```
Di cPanel: **Git Version Control → Pull or Deploy → Update from Remote**, lalu panel Node App → **Restart**. Tanpa build, tanpa migrate (kecuali skema berubah → muat SQL migrasi baru lewat phpPgAdmin).

## Akun login pertama
Seed bikin 2 Boss: `boss1@tirtonichub.com`, `boss2@tirtonichub.com` (nomor WA fiktif — ganti via HR/DB ke nomor asli biar OTP WA kekirim).
