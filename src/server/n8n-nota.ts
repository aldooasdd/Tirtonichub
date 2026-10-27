// Foto nota → n8n (OpenAI vision) → item terstruktur. Pola sama dgn n8n OTP.
// Webhook belum diset / gagal → return null, app fallback ke input manual.

export type NotaItem = {
  name: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  qty: number;
  unit: string | null;
  unitPrice: number;
  supplier: string | null;
  notaDate: string | null; // "YYYY-MM-DD"
};

function str(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Harga satuan = harga net dibayar per unit, sesuai nota (sudah termasuk diskon
 * & PPN). Prefer total ÷ qty; tanpa total pakai harga satuan dari OCR.
 * PPN TIDAK ditambah di sini — prompt OCR yang gross-up bila nota PPN-exclusive.
 */
export function computeUnitPrice(qty: number, totalPrice: number, unitPriceOcr: number): number {
  const q = Math.max(1, qty || 1);
  const base = totalPrice > 0 ? totalPrice / q : unitPriceOcr;
  return Math.max(0, Math.round(base));
}

function normalize(raw: unknown): NotaItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const date = typeof o.notaDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.notaDate) ? o.notaDate : null;
  const qty = Math.max(1, toInt(o.qty) || 1);
  return {
    name: String(o.name ?? "").slice(0, 200),
    brand: str(o.brand, 80),
    color: str(o.color, 40),
    size: str(o.size, 40),
    sku: str(o.sku, 60),
    qty,
    unit: o.unit ? String(o.unit).slice(0, 20) : null,
    unitPrice: computeUnitPrice(qty, toInt(o.totalPrice), toInt(o.unitPrice)),
    supplier: o.supplier ? String(o.supplier).slice(0, 120) : null,
    notaDate: date,
  };
}

/** Kirim foto nota ke n8n, terima daftar item. null bila belum diset / gagal. */
export async function parseNotaViaN8n(
  imageBase64: string,
  mimeType: string,
): Promise<NotaItem[] | null> {
  const url = process.env.N8N_NOTA_OCR_WEBHOOK_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_NOTA_OCR_SECRET ?? "",
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    if (!Array.isArray(data.items)) return null;
    return data.items.map(normalize).filter((i) => i.name);
  } catch {
    return null;
  }
}
