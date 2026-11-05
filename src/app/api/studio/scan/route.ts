import { NextRequest } from "next/server";
import { StudioError } from "@/server/studio/store";
import { fail, guarded, ok } from "@/server/studio/http";
import { scanProductViaN8n } from "@/server/n8n-product-scan";

// Baca foto barang (formulir Barang masuk): nama, warna, kategori, gender ukuran diisi otomatis
// lewat n8n → OpenAI (N8N_PRODUCT_SCAN_WEBHOOK_URL). Hanya admin/Admin 2 (yang boleh mencatat barang).
const MAX_B64 = 3_000_000;

export async function POST(req: NextRequest) {
  return guarded(async (u) => {
    if (!u.staff) throw new StudioError("permission-denied", "Hanya admin yang bisa memakai baca foto.");
    const body = (await req.json().catch(() => null)) as { image?: unknown; hint?: unknown } | null;
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body?.image ?? ""));
    if (!m || m[2].length > MAX_B64) throw new StudioError("invalid-argument", "Foto tidak valid atau terlalu besar.");
    const r = await scanProductViaN8n(m[2], m[1], String(body?.hint ?? "").slice(0, 200));
    if (!r.ok) return fail(r.off ? 503 : 502, r.off ? "ai-off" : "unavailable", r.error);
    return ok({ ok: true, ...r.data });
  });
}
