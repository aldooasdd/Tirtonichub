"use server";

// Pasangkan Tag (Tirtonic Channel): scan barcode SKU → scan stiker RFID satu per satu → tersimpan.
// Reader HC-YK947 mode keyboard: tiap scan = kode + Enter. EPC UCODE 9 = 24 huruf hex.
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";

type SkuInfo = { sku: string; name: string | null; variant: string | null; image: string | null; tags: number };
type TagRes = { ok: boolean; status: "baru" | "sudah" | "pindah" | "milik-lain" | "error"; message: string; tags?: number; from?: string };

/** Info barang untuk SKU yang di-scan (nama dari Produk Master, kalau ada). */
export async function lookupSku(raw: string): Promise<SkuInfo> {
  await requireChannel();
  const sku = raw.trim();
  const eq = { equals: sku, mode: "insensitive" as const };
  const [it, tags] = await Promise.all([
    prisma.marketplaceItem.findFirst({
      where: { deletedAt: null, shopId: { not: "demo" }, OR: [{ localSku: eq }, { localSku: null, sku: eq }] },
      select: { name: true, localName: true, variant: true, image: true },
    }),
    prisma.rfidTag.count({ where: { sku } }),
  ]);
  return { sku, name: it ? (it.localName ?? it.name) : null, variant: it?.variant ?? null, image: it?.image ?? null, tags };
}

/** Pasang 1 tag ke SKU. Tag milik SKU lain → tolak kecuali move=true. */
export async function pairTag(rawEpc: string, rawSku: string, move = false): Promise<TagRes> {
  const ctx = await requireChannel();
  const epc = rawEpc.trim().toUpperCase(), sku = rawSku.trim();
  if (!sku) return { ok: false, status: "error", message: "Scan barcode SKU dulu." };
  const cur = await prisma.rfidTag.findUnique({ where: { epc } });
  if (cur?.sku === sku) return { ok: true, status: "sudah", message: "Tag ini sudah terpasang di SKU ini.", tags: await prisma.rfidTag.count({ where: { sku } }) };
  if (cur && !move) return { ok: false, status: "milik-lain", message: `Tag ini sudah terpasang di SKU ${cur.sku}.`, from: cur.sku };
  await prisma.rfidTag.upsert({ where: { epc }, create: { epc, sku, userId: ctx.userId }, update: { sku, userId: ctx.userId } });
  const tags = await prisma.rfidTag.count({ where: { sku } });
  return cur
    ? { ok: true, status: "pindah", message: `Dipindah dari SKU ${cur.sku}.`, tags }
    : { ok: true, status: "baru", message: "Tag terpasang.", tags };
}

/** Tag ini milik SKU apa (scan tag tanpa pilih SKU). */
export async function whoseTag(rawEpc: string): Promise<{ sku: string | null }> {
  await requireChannel();
  const t = await prisma.rfidTag.findUnique({ where: { epc: rawEpc.trim().toUpperCase() }, select: { sku: true } });
  return { sku: t?.sku ?? null };
}

/** Lepas tag (stiker rusak / salah tempel). */
export async function unpairTag(rawEpc: string): Promise<{ ok: boolean }> {
  await requireChannel();
  await prisma.rfidTag.deleteMany({ where: { epc: rawEpc.trim().toUpperCase() } });
  return { ok: true };
}
