"use server";

// Cek SKU (Tirtonic Channel): orang toko konfirmasi saran SKU dari Accurate / scan barcode barang.
// Satu aksi berlaku untuk semua baris ber-groupKey sama (varian sama di Shopee/Tokopedia/Tirtonic.com).
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { pushSkus } from "@/server/marketplace/push-sku";
import { productKey } from "@/server/marketplace/product-groups";

type Res = { ok: boolean; message?: string };
const PATH = "/channel/produk/cek-sku";

const cell = (v: ExcelJS.CellValue) =>
  (v == null ? "" : typeof v === "object" && "text" in v ? String(v.text) : typeof v === "object" && "result" in v ? String(v.result ?? "") : String(v)).trim();

/** Muat antrian dari file hasil cocok Accurate (kolom "Cocok" = RAGU… / TIDAK KETEMU). Baris yang sudah dicek tidak ditimpa.
 *  replace = true → antrian "belum dicek" lama dihapus dulu (ganti file, mis. per merek). */
export async function loadSkuCheckFile(base64: string, replace = false): Promise<Res> {
  const ctx = await requireChannel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(base64, "base64") as unknown as ArrayBuffer);
  } catch {
    return { ok: false, message: "File bukan Excel (.xlsx)." };
  }
  const ws = wb.worksheets[0];
  const head = (ws?.getRow(1).values as ExcelJS.CellValue[] | undefined)?.map(cell) ?? [];
  const col = (name: string) => head.indexOf(name);
  const ci = col("ID (jangan diubah)"), cn = col("Nama Produk"), cv = col("Varian"), cc = col("Cocok");
  const sn = col("Saran Accurate (RAGU, cek manual)"), su = col("Saran UPC"), ss = col("Saran Stok");
  if (ci < 0 || cn < 0 || cc < 0) return { ok: false, message: 'Kolom "ID (jangan diubah)", "Nama Produk", "Cocok" tidak ada. Pakai file hasil cocok Accurate.' };

  const rows: { itemId: string; groupKey: string; kind: string; saranNama: string | null; saranUpc: string | null; saranStok: number | null }[] = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const id = cell(r.getCell(ci).value);
    const cocok = cell(r.getCell(cc).value).toUpperCase();
    const kind = cocok.startsWith("RAGU") ? "RAGU" : cocok.startsWith("TIDAK") ? "TIDAK" : null;
    if (!id || !kind) return;
    const nama = cell(r.getCell(cn).value), varian = cv >= 0 ? cell(r.getCell(cv).value) : "";
    const stok = ss >= 0 ? Number(cell(r.getCell(ss).value)) : NaN;
    rows.push({
      itemId: id,
      groupKey: productKey(nama.includes(varian) ? nama : `${nama} ${varian}`),
      kind,
      saranNama: (sn >= 0 && cell(r.getCell(sn).value)) || null,
      saranUpc: (su >= 0 && cell(r.getCell(su).value)) || null,
      saranStok: Number.isFinite(stok) && cell(r.getCell(ss).value) !== "" ? stok : null,
    });
  });
  if (!rows.length) return { ok: false, message: "Tidak ada baris RAGU / TIDAK KETEMU di file." };

  const known = new Set((await prisma.marketplaceItem.findMany({ where: { id: { in: rows.map((r) => r.itemId) } }, select: { id: true } })).map((x) => x.id));
  const done = new Set((await prisma.skuCheck.findMany({ where: { status: { not: "pending" } }, select: { itemId: true } })).map((x) => x.itemId));
  const fresh = rows.filter((r) => known.has(r.itemId) && !done.has(r.itemId));
  await prisma.$transaction([
    prisma.skuCheck.deleteMany({ where: replace ? { status: "pending" } : { status: "pending", itemId: { in: fresh.map((r) => r.itemId) } } }),
    prisma.skuCheck.createMany({ data: fresh, skipDuplicates: true }),
  ]);
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sku_check_load", entity: "SkuCheck", entityId: "bulk", after: { rows: rows.length, loaded: fresh.length, replace } });
  revalidatePath(PATH);
  return { ok: true, message: `${fresh.length} baris masuk antrian Cek SKU (${rows.length - fresh.length} dilewati: sudah dicek / produk tidak ada).` };
}

async function finish(groupKey: string, status: "done" | "missing", sku: string | null): Promise<Res> {
  const ctx = await requireChannel();
  const rows = await prisma.skuCheck.findMany({ where: { groupKey }, select: { id: true, itemId: true } });
  if (!rows.length) return { ok: false, message: "Barang tidak ditemukan di antrian." };
  await prisma.$transaction([
    prisma.skuCheck.updateMany({ where: { groupKey }, data: { status, sku, checkedById: ctx.userId, checkedAt: new Date(), pushedAt: null } }),
    ...(sku ? [prisma.marketplaceItem.updateMany({ where: { id: { in: rows.map((r) => r.itemId) } }, data: { localSku: sku } })] : []),
  ]);
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sku_check", entity: "SkuCheck", entityId: groupKey, after: { status, sku } });
  revalidatePath(PATH);
  return { ok: true, message: status === "missing" ? "Ditandai tidak ada di toko." : `SKU ${sku} tersimpan.` };
}

/** Saran Accurate benar → pakai UPC saran. */
export async function confirmSaran(groupKey: string): Promise<Res> {
  await requireChannel();
  const r = await prisma.skuCheck.findFirst({ where: { groupKey, saranUpc: { not: null } }, select: { saranUpc: true } });
  if (!r?.saranUpc) return { ok: false, message: "Saran ini tidak punya UPC — scan barcode barangnya." };
  return finish(groupKey, "done", r.saranUpc);
}

/** Scan barcode (Zebra) / ketik SKU. */
export async function setScannedSku(groupKey: string, raw: string): Promise<Res> {
  await requireChannel();
  const sku = raw.trim();
  if (!sku) return { ok: false, message: "SKU kosong." };
  if (/\s/.test(sku) || sku.length > 50) return { ok: false, message: "SKU tidak boleh berspasi & maks 50 huruf." };
  return finish(groupKey, "done", sku);
}

export async function markMissing(groupKey: string): Promise<Res> {
  return finish(groupKey, "missing", null);
}

/** Buka lagi (salah klik). SKU lokal tidak dihapus. */
export async function reopenCheck(groupKey: string): Promise<Res> {
  await requireChannel();
  await prisma.skuCheck.updateMany({ where: { groupKey }, data: { status: "pending", checkedById: null, checkedAt: null } });
  revalidatePath(PATH);
  return { ok: true };
}

/** Kirim SKU hasil cek (yang belum terkirim) ke Shopee & Tokopedia. */
export async function pushCheckedSkus(): Promise<Res> {
  const ctx = await requireChannel();
  const rows = await prisma.skuCheck.findMany({ where: { status: "done", pushedAt: null, sku: { not: null } }, select: { id: true, itemId: true, sku: true } });
  if (!rows.length) return { ok: true, message: "Tidak ada SKU baru untuk dikirim." };
  const push = await pushSkus(rows.map((r) => ({ id: r.itemId, sku: r.sku! })));
  // ponytail: semua ditandai terkirim, termasuk yang gagal (pushSkus tak kasih id gagal). Gagal → ulangi dari Produk Master per varian.
  await prisma.skuCheck.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { pushedAt: new Date() } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "sku_check_push", entity: "SkuCheck", entityId: "bulk", after: { rows: rows.length, sent: push.sent, fail: push.fail.length } });
  revalidatePath(PATH);
  const base = `${push.sent} produk terkirim ke Shopee/Tokopedia.`;
  return push.fail.length ? { ok: false, message: `${base} Gagal ${push.fail.length}: ${push.fail.slice(0, 5).join(" · ")}` } : { ok: true, message: base };
}
