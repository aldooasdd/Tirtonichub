// Foto nota → n8n (OpenAI vision) → item terstruktur. Pola sama dgn n8n OTP.
// Webhook belum diset / gagal → return null, app fallback ke input manual.

export type NotaItem = {
  name: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  supplier: string | null;
  notaDate: string | null; // "YYYY-MM-DD"
};

function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalize(raw: unknown): NotaItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const date = typeof o.notaDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.notaDate) ? o.notaDate : null;
  return {
    name: String(o.name ?? "").slice(0, 200),
    qty: Math.max(1, toInt(o.qty) || 1),
    unit: o.unit ? String(o.unit).slice(0, 20) : null,
    unitPrice: Math.max(0, toInt(o.unitPrice)),
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
