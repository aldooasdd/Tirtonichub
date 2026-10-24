# Workflow n8n — OCR Nota (Finance)

App kirim foto nota → workflow (OpenAI vision) → daftar item → app isi kartu produk mentah.

File: `tirtonic-nota-ocr.workflow.json`. Build tools MCP dimatikan, jadi di-import manual.

## Pasang

1. **n8n → Workflows → Import from File** → pilih `tirtonic-nota-ocr.workflow.json`.
2. Buat **2 credential** (node-nya sudah nunjuk, tinggal pilih/isi):
   - **Header Auth** `x-webhook-secret (nota)` → Name: `x-webhook-secret`, Value: secret bebas yang kuat.
   - **OpenAI** → API key OpenAI kamu (butuh model `gpt-4o`, ada biaya per gambar).
3. **Activate** (publish) workflow.
4. Ambil **Production URL** webhook: `https://n8n.tirtonic.com/webhook/tirtonic-nota-ocr`.
5. (Opsional, privasi) Settings workflow → matikan **Save execution data** biar foto nota tak tersimpan di log.

## Wiring ke app (env)

```
N8N_NOTA_OCR_WEBHOOK_URL=https://n8n.tirtonic.com/webhook/tirtonic-nota-ocr
N8N_NOTA_OCR_SECRET=<value header x-webhook-secret yang sama>
```

Kosongkan keduanya → tombol Scan Nota jatuh ke kartu manual (tanpa OCR).

## Kontrak

- Masuk (POST): `{ "imageBase64": "<base64 jpg>", "mimeType": "image/jpeg" }`, header `x-webhook-secret`.
- Keluar: `{ "items": [ { "name", "qty", "unit", "unitPrice", "supplier", "notaDate" } ] }`.
