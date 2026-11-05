# Workflow n8n — Baca Foto Barang (Studio)

Formulir **Barang masuk** di Studio kirim foto barang → workflow (OpenAI vision) → nama, warna, kategori, gender → formulir terisi otomatis.
Pola sama dengan OCR Nota (`README-nota-ocr.md`), credential-nya bisa dipakai ulang.

File: `tirtonic-produk-scan.workflow.json` (import manual).

## Pasang

1. **n8n → Workflows → Import from File** → pilih `tirtonic-produk-scan.workflow.json`.
2. Pilih credential yang sudah ada di node:
   - Webhook → **Header Auth** `x-webhook-secret (nota)` (sama dengan OCR Nota).
   - OpenAI Vision → **OpenAI** (model `gpt-4o`, ada biaya per gambar).
3. **Activate** (publish) workflow.
4. Production URL: `https://n8n.tirtonic.com/webhook/tirtonic-produk-scan`.
5. (Opsional, privasi) Settings workflow → matikan **Save execution data**.

## Wiring ke app (env)

```
N8N_PRODUCT_SCAN_WEBHOOK_URL=https://n8n.tirtonic.com/webhook/tirtonic-produk-scan
# opsional; kosong → pakai N8N_NOTA_OCR_SECRET
N8N_PRODUCT_SCAN_SECRET=
```

Kosong → Studio diam saja (formulir isi manual seperti biasa).

## Kontrak

- Masuk (POST, header `x-webhook-secret`): `{ "imageBase64": "<base64>", "mimeType": "image/jpeg", "hint": "<nama dari nota QC atau ''>" }`.
- Keluar: `{ "name", "color", "category": "sepatu|raket|tas|baju|celana|aksesoris|lainnya", "gender": "men|women|unisex|''" }`.
  App menormalkan lagi (kategori/gender di luar daftar dikosongkan).
