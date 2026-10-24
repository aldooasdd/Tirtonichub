# Deploy di PC server (Docker + Cloudflare Tunnel)

App + Postgres jalan sebagai container di PC. Build di PC (mesin penuh, bukan cPanel).
Foto pakai MinIO yang sudah jalan. Publik lewat Cloudflare Tunnel yang sudah ada.

## 1. Clone repo (di PC)
```bash
git clone https://github.com/aldooasdd/Tirtonichub.git
cd Tirtonichub
```

## 2. Buat .env
```bash
cp .env.pc.example .env
```
Isi `.env`:
- `POSTGRES_PASSWORD` = password kuat; `DATABASE_URL` pakai password yang SAMA.
- `AUTH_SECRET` = `openssl rand -hex 32` (atau generator lain).
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` = kunci MinIO di PC ini.

## 3. Build + jalan
```bash
docker compose up -d --build
```
(Build pertama agak lama. Kalau OOM: naikkan memory WSL di `.wslconfig`.)

## 4. Siapkan DB (sekali)
```bash
docker compose exec web pnpm db:deploy   # terapkan skema/migrasi
docker compose exec web pnpm db:seed     # 8 role, 2 Boss, 3 cabang
```

## 5. Cek lokal
Buka `http://localhost:3000` di PC → halaman login muncul = OK.

## 6. Sambungkan domain (Cloudflare Tunnel yang sudah ada)
Cloudflare **Zero Trust → Networks → Tunnels → (tunnel kamu) → Public Hostname → Add**:
- Subdomain/domain: `tirtonic.com` (atau subdomain yang mau).
- Service: **HTTP** `host.docker.internal:3000`.

Simpan → buka `https://tirtonic.com`.

> cloudflared dan web beda compose, jadi route pakai `host.docker.internal:3000`
> (web dipublish ke host:3000). DNS `tirtonic.com` otomatis diurus tunnel.

## Update berikutnya
```bash
git pull
docker compose up -d --build
# skema berubah? docker compose exec web pnpm db:deploy
```

## Login pertama
Seed bikin 2 Boss: `boss1@tirtonichub.com`, `boss2@tirtonichub.com` (WA fiktif — ganti ke WA asli lewat HR biar OTP WA kekirim; tanpa n8n, OTP tampil di `docker compose logs web`).
