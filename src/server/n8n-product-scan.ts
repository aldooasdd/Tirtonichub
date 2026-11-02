// Foto barang (Studio, formulir Barang masuk) → n8n (OpenAI vision) → nama, warna, kategori, gender.
// Pola sama dgn n8n-nota. Webhook belum diset → { off: true }, UI diam (isi manual).

const CATS = ["sepatu", "raket", "tas", "baju", "celana", "aksesoris", "lainnya"] as const;
const GENDERS = ["men", "women", "unisex"] as const;

export type ProductScan = { name: string; color: string; category: string; gender: string };
export type ProductScanResult = { ok: true; data: ProductScan } | { ok: false; off?: boolean; error: string };

const pick = <T extends string>(v: unknown, list: readonly T[]): T | "" => {
  const s = String(v ?? "").trim().toLowerCase();
  return (list as readonly string[]).includes(s) ? (s as T) : "";
};

export async function scanProductViaN8n(imageBase64: string, mimeType: string, hint: string): Promise<ProductScanResult> {
  const url = process.env.N8N_PRODUCT_SCAN_WEBHOOK_URL;
  if (!url) return { ok: false, off: true, error: "Baca foto otomatis belum disiapkan di server." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.N8N_PRODUCT_SCAN_SECRET || process.env.N8N_NOTA_OCR_SECRET || "",
      },
      body: JSON.stringify({ imageBase64, mimeType, hint }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, error: "Gagal membaca foto (HTTP " + res.status + "). Isi manual atau coba lagi." };
    const o = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const category = pick(o.category, CATS);
    return {
      ok: true,
      data: {
        name: String(o.name ?? "").trim().slice(0, 120),
        color: String(o.color ?? "").trim().toLowerCase().slice(0, 60),
        category,
        gender: ["sepatu", "baju", "celana"].includes(category) ? pick(o.gender, GENDERS) : "",
      },
    };
  } catch {
    return { ok: false, error: "Layanan baca foto tidak bisa dihubungi. Isi manual atau coba lagi." };
  }
}
