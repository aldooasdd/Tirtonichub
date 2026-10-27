// PDF penjualan Accurate → n8n (Extract From File + OpenAI) → daftar faktur.
// Webhook belum diset / gagal → null.

export type AccurateSale = {
  notaNo: string | null;
  date: string | null; // "YYYY-MM-DD"
  customer: string | null;
  total: number;
};

function str(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function norm(raw: unknown): AccurateSale {
  const o = (raw ?? {}) as Record<string, unknown>;
  const d = typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date) ? o.date.slice(0, 10) : null;
  return { notaNo: str(o.notaNo, 60), date: d, customer: str(o.customer, 120), total: toInt(o.total) };
}

/** Kirim PDF Accurate (base64) ke n8n, terima daftar faktur. null bila gagal. */
export async function parseAccurateViaN8n(pdfBase64: string): Promise<AccurateSale[] | null> {
  const url = process.env.N8N_ACCURATE_WEBHOOK_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_ACCURATE_SECRET ?? process.env.N8N_NOTA_OCR_SECRET ?? "",
      },
      body: JSON.stringify({ pdfBase64 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sales?: unknown };
    if (!Array.isArray(data.sales)) return null;
    return data.sales.map(norm).filter((s) => s.total > 0 || s.notaNo);
  } catch {
    return null;
  }
}
