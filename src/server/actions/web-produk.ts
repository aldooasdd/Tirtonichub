"use server";

import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { websiteReady, websiteSimpan, websiteUpload, type WebProdukBaru } from "@/server/marketplace/website";

// Produk web baru: form manual di Tirtonic Channel → tirtonic.com (/api/hub upload & simpan).
type Res<T> = { ok: true; data: T } | { ok: false; message: string };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");
const base = () => (process.env.TIRTONIC_WEB_URL || "https://www.tirtonic.com").replace(/\/$/, "");

export async function uploadFotoWeb(foto: { nama: string; tipe: string; data: string }): Promise<Res<string>> {
  await requireProduk();
  if (!websiteReady()) return { ok: false, message: "POINTS_API_SECRET belum diset." };
  try {
    return { ok: true, data: await websiteUpload(foto) };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function simpanProdukWeb(p: WebProdukBaru): Promise<Res<{ url: string; created: boolean }>> {
  const auth = await requireProduk();
  if (!websiteReady()) return { ok: false, message: "POINTS_API_SECRET belum diset." };
  try {
    const r = await websiteSimpan(p);
    const { ip } = await clientMeta();
    await logActivity({ ...auth, ip }, { action: r.created ? "web_product_create" : "web_product_edit", entity: "WebsiteProduct", entityId: r.id, after: { nama: p.nama } });
    return { ok: true, data: { url: `${base()}/product/${r.slug || r.id}`, created: r.created } };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}
