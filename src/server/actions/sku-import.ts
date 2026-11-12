"use server";

// Isi SKU massal: export Excel → isi kolom "SKU Tirtonichub" → upload → pratinjau → simpan.
// SKU hanya di Tirtonichub (localSku); marketplace tidak diubah.
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";

import { SKU_COLS } from "@/lib/sku-cols";
export type SkuChange = { id: string; toko: string; nama: string; from: string; to: string };
type Res<T = undefined> = { ok: boolean; message?: string; data?: T };

const cell = (v: ExcelJS.CellValue) => (v == null ? "" : typeof v === "object" && "text" in v ? String(v.text) : typeof v === "object" && "result" in v ? String(v.result ?? "") : String(v)).trim();

/** Baca file, bandingkan dengan SKU sekarang. Tidak menyimpan apa pun. */
export async function previewSkuImport(base64: string): Promise<Res<{ changes: SkuChange[]; same: number; unknown: number }>> {
  await requireProduk();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(base64, "base64") as unknown as ArrayBuffer);
  } catch {
    return { ok: false, message: "File bukan Excel (.xlsx)." };
  }
  const ws = wb.worksheets[0];
  const head = (ws?.getRow(1).values as ExcelJS.CellValue[] | undefined)?.map(cell) ?? [];
  const ci = head.indexOf(SKU_COLS.id), cs = head.indexOf(SKU_COLS.sku);
  if (ci < 0 || cs < 0) return { ok: false, message: `Kolom "${SKU_COLS.id}" dan "${SKU_COLS.sku}" tidak ada. Pakai file dari tombol Export.` };

  const want = new Map<string, string>();
  ws.eachRow((r, i) => {
    const id = cell(r.getCell(ci).value);
    if (i > 1 && id) want.set(id, cell(r.getCell(cs).value).slice(0, 100));
  });
  const items = await prisma.marketplaceItem.findMany({ where: { id: { in: [...want.keys()] } }, select: { id: true, platform: true, name: true, localName: true, variant: true, sku: true, localSku: true } });
  const changes: SkuChange[] = [];
  for (const it of items) {
    const now = it.localSku ?? it.sku ?? "";
    const to = want.get(it.id)!;
    if (to !== now)
      changes.push({ id: it.id, toko: it.platform, nama: `${it.localName ?? it.name}${it.variant ? ` · ${it.variant}` : ""}`, from: now, to });
  }
  return { ok: true, data: { changes, same: items.length - changes.length, unknown: want.size - items.length } };
}

/** Simpan hasil pratinjau. Kosong / sama dengan SKU marketplace → kembali ke SKU marketplace. */
export async function applySkuImport(list: { id: string; to: string }[]): Promise<Res> {
  const ctx = await requireProduk();
  const items = await prisma.marketplaceItem.findMany({ where: { id: { in: list.slice(0, 20000).map((x) => x.id) } }, select: { id: true, sku: true } });
  const to = new Map(list.map((x) => [x.id, x.to.trim().slice(0, 100)]));
  await prisma.$transaction(
    items.map((it) => {
      const s = to.get(it.id)!;
      return prisma.marketplaceItem.update({ where: { id: it.id }, data: { localSku: !s || s === it.sku ? null : s } });
    }),
  );
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "produk_sku_import", entity: "MarketplaceItem", entityId: "bulk", after: { count: items.length } });
  revalidatePath("/channel/produk");
  return { ok: true, message: `${items.length} SKU tersimpan.` };
}
