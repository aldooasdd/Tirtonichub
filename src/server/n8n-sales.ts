// Foto nota penjualan → n8n (OpenAI vision) → data penjualan terstruktur.
// Pola sama dgn n8n-nota (pembelian). Webhook belum diset / gagal → null, app fallback input manual.

export type SalesItem = { name: string; qty: number; price: number; total: number; note: string | null };
export type SalesPayment = { method: string; amount: number };

export type SalesParsed = {
  notaNo: string | null;
  soldAt: string | null; // ISO "YYYY-MM-DDTHH:mm" atau null
  branch: string | null; // cabang/toko dari header nota (mis. "Semarang")
  customer: string | null;
  salesman: string | null;
  employee: string | null;
  items: SalesItem[];
  subtotal: number;
  total: number;
  grandTotal: number;
  payments: SalesPayment[];
};

function str(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normItem(raw: unknown): SalesItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const qty = Math.max(1, toInt(o.qty) || 1);
  const price = toInt(o.price);
  // total eksplisit (termasuk 0 utk diskon 100%) dihormati; fallback price*qty hanya bila kosong.
  const hasTotal = o.total !== undefined && o.total !== null && String(o.total).trim() !== "";
  const total = hasTotal ? toInt(o.total) : price * qty;
  return { name: String(o.name ?? "").slice(0, 200), qty, price, total, note: str(o.note, 300) };
}
function normPayment(raw: unknown): SalesPayment {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { method: String(o.method ?? "").slice(0, 60) || "-", amount: toInt(o.amount) };
}

/** null bila belum diset / gagal. Hasil sudah dinormalisasi. */
export async function parseSalesNotaViaN8n(imageBase64: string, mimeType: string): Promise<SalesParsed | null> {
  const url = process.env.N8N_SALES_OCR_WEBHOOK_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_SALES_OCR_SECRET || process.env.N8N_NOTA_OCR_SECRET || "",
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(d.items) ? d.items.map(normItem).filter((i) => i.name) : [];
    const payments = Array.isArray(d.payments) ? d.payments.map(normPayment).filter((p) => p.amount) : [];
    const soldAtRaw = typeof d.soldAt === "string" ? d.soldAt.trim() : "";
    const soldAt = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(soldAtRaw) ? soldAtRaw.replace(" ", "T") : null;
    return {
      notaNo: str(d.notaNo, 60),
      soldAt,
      branch: str(d.branch, 120),
      customer: str(d.customer, 120),
      salesman: str(d.salesman, 120),
      employee: str(d.employee, 120),
      items,
      subtotal: toInt(d.subtotal),
      total: toInt(d.total),
      grandTotal: toInt(d.grandTotal) || toInt(d.total),
      payments,
    };
  } catch {
    return null;
  }
}
