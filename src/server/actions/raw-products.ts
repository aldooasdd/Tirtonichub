"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { requireFinance, requireStock } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { parseNotaViaN8n, type NotaItem } from "@/server/n8n-nota";
import { computeSellPrice } from "@/lib/pricing";
import { notifyBosses } from "@/server/notify";
import { dateKeyWIB } from "@/server/attendance/logic";

export type ActionResult = { ok: boolean; message?: string };

export type ScanResult = {
  ok: boolean;
  message?: string;
  batchId?: string;
  notaPhotoKey?: string;
  items?: NotaItem[];
  ocr?: boolean; // true bila n8n mengisi, false bila manual
};

/** Upload foto nota + OCR via n8n. Tidak menyimpan DB (biar diedit dulu). */
export async function scanNota(imageBase64: string, mimeType: string): Promise<ScanResult> {
  await requireFinance();
  if (!imageBase64) return { ok: false, message: "Foto nota kosong." };

  const ext = mimeType.includes("png") ? "png" : "jpg";
  const key = makeKey("nota", ext);
  try {
    const buf = Buffer.from(imageBase64, "base64");
    await putObject(key, buf, mimeType || "image/jpeg");
  } catch {
    return { ok: false, message: "Gagal simpan foto nota." };
  }

  const items = await parseNotaViaN8n(imageBase64, mimeType);
  return {
    ok: true,
    batchId: randomUUID(),
    notaPhotoKey: key,
    items: items ?? [],
    ocr: items !== null,
  };
}

type SaveItem = {
  name: string;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  qty: number;
  unit?: string | null;
  unitPrice: number;
  supplier?: string | null;
  notaDate?: string | null;
};

const clean = (v: string | null | undefined, max: number): string | null =>
  v?.trim() ? v.trim().slice(0, max) : null;

/** Simpan kartu produk mentah (status DRAFT). */
export async function saveRawBatch(input: {
  batchId: string;
  notaPhotoKey?: string | null;
  items: SaveItem[];
}): Promise<ActionResult> {
  const ctx = await requireFinance();
  const items = input.items.filter((i) => i.name.trim());
  if (items.length === 0) return { ok: false, message: "Tidak ada item." };

  await prisma.rawProduct.createMany({
    data: items.map((i) => {
      const unitPrice = Math.max(0, Math.round(i.unitPrice) || 0);
      return {
      batchId: input.batchId,
      name: i.name.trim().slice(0, 200),
      brand: clean(i.brand, 80),
      color: clean(i.color, 40),
      size: clean(i.size, 40),
      sku: clean(i.sku, 60),
      qty: Math.max(1, Math.round(i.qty) || 1),
      unit: i.unit?.trim() || null,
      unitPrice,
      sellPrice: computeSellPrice(unitPrice),
      supplier: i.supplier?.trim() || null,
      notaDate: i.notaDate ? new Date(i.notaDate) : null,
      notaPhotoKey: input.notaPhotoKey ?? null,
      status: "DRAFT" as const,
      createdById: ctx.userId,
      };
    }),
  });

  const { ip } = await clientMeta();
  await logActivity(
    { ...ctx, ip },
    { action: "create", entity: "RawProduct", entityId: input.batchId, after: { count: items.length } },
  );
  return { ok: true };
}

/** Edit satu kartu DRAFT milik sendiri. */
export async function updateRawProduct(id: string, fields: SaveItem): Promise<ActionResult> {
  const ctx = await requireFinance();
  const p = await prisma.rawProduct.findUnique({ where: { id } });
  if (!p || p.createdById !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  if (p.status !== "DRAFT") return { ok: false, message: "Hanya draft bisa diedit." };
  const unitPrice = Math.max(0, Math.round(fields.unitPrice) || 0);
  await prisma.rawProduct.update({
    where: { id },
    data: {
      name: fields.name.trim().slice(0, 200),
      brand: clean(fields.brand, 80),
      color: clean(fields.color, 40),
      size: clean(fields.size, 40),
      sku: clean(fields.sku, 60),
      qty: Math.max(1, Math.round(fields.qty) || 1),
      unit: fields.unit?.trim() || null,
      unitPrice,
      sellPrice: computeSellPrice(unitPrice),
      supplier: fields.supplier?.trim() || null,
      notaDate: fields.notaDate ? new Date(fields.notaDate) : null,
    },
  });
  return { ok: true };
}

/** Hapus kartu DRAFT milik sendiri. */
export async function deleteRawProduct(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  const p = await prisma.rawProduct.findUnique({ where: { id } });
  if (!p || p.createdById !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  if (p.status !== "DRAFT") return { ok: false, message: "Hanya draft bisa dihapus." };
  await prisma.rawProduct.delete({ where: { id } });
  return { ok: true };
}

/** Simpan banyak kartu DRAFT milik sendiri sekaligus. */
export async function saveRawItems(items: Array<SaveItem & { id: string }>): Promise<ActionResult> {
  const ctx = await requireFinance();
  const own = await prisma.rawProduct.findMany({
    where: { id: { in: items.map((i) => i.id) }, createdById: ctx.userId, status: "DRAFT" },
    select: { id: true },
  });
  const allowed = new Set(own.map((o) => o.id));
  await prisma.$transaction(
    items
      .filter((i) => allowed.has(i.id))
      .map((i) => {
        const unitPrice = Math.max(0, Math.round(i.unitPrice) || 0);
        return prisma.rawProduct.update({
          where: { id: i.id },
          data: {
            name: i.name.trim().slice(0, 200),
            brand: clean(i.brand, 80),
            color: clean(i.color, 40),
            size: clean(i.size, 40),
            sku: clean(i.sku, 60),
            qty: Math.max(1, Math.round(i.qty) || 1),
            unit: i.unit?.trim() || null,
            unitPrice,
            sellPrice: computeSellPrice(unitPrice),
            supplier: i.supplier?.trim() || null,
            notaDate: i.notaDate ? new Date(i.notaDate) : null,
          },
        });
      }),
  );
  return { ok: true };
}

/** Hapus seluruh kartu DRAFT dalam satu batch milik sendiri. */
export async function deleteBatch(batchId: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  const r = await prisma.rawProduct.deleteMany({
    where: { batchId, createdById: ctx.userId, status: "DRAFT" },
  });
  if (r.count === 0) return { ok: false, message: "Tidak ada draft untuk dihapus." };
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "delete", entity: "RawProduct", entityId: batchId });
  return { ok: true };
}

/** Kirim satu kartu DRAFT milik sendiri ke Quality Control. */
export async function submitItemToQc(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  const p = await prisma.rawProduct.findUnique({ where: { id } });
  if (!p || p.createdById !== ctx.userId) return { ok: false, message: "Tidak ditemukan." };
  if (p.status !== "DRAFT") return { ok: false, message: "Hanya draft bisa dikirim." };
  await prisma.rawProduct.update({ where: { id }, data: { status: "QC" } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "submit_qc", entity: "RawProduct", entityId: id });
  await notifyBosses({ type: "qc_in", title: `Produk mentah masuk QC: ${p.name}`, link: "/stok/qc" });
  return { ok: true };
}

/** Kirim seluruh batch DRAFT ke Quality Control (Stock Room). */
export async function submitBatchToQc(batchId: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  const r = await prisma.rawProduct.updateMany({
    where: { batchId, createdById: ctx.userId, status: "DRAFT" },
    data: { status: "QC" },
  });
  if (r.count === 0) return { ok: false, message: "Tidak ada draft untuk dikirim." };
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "submit_qc", entity: "RawProduct", entityId: batchId });
  await notifyBosses({ type: "qc_in", title: `${r.count} produk mentah masuk QC`, link: "/stok/qc" });
  return { ok: true };
}

/** Keputusan QC oleh Stock Room: lolos → STOCK (qty = total lolos), tolak → REJECTED. */
export type QcEdits = {
  name?: string;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  qty?: number;
  unit?: string | null;
  sellPrice?: number;
  supplier?: string | null;
};

export async function qcDecision(
  id: string,
  decision: "STOCK" | "REJECTED",
  edits?: QcEdits,
  photo?: { base64: string; mime?: string },
): Promise<ActionResult> {
  const ctx = await requireStock();
  const p = await prisma.rawProduct.findUnique({ where: { id } });
  if (!p) return { ok: false, message: "Tidak ditemukan." };
  if (p.status !== "QC") return { ok: false, message: "Item tidak dalam antrean QC." };
  if (decision === "STOCK" && !clean(edits?.sku, 60)) return { ok: false, message: "SKU barcode wajib diisi/scan." };
  if (decision === "STOCK" && !photo?.base64) return { ok: false, message: "Ambil foto dokumentasi produk dulu sebelum loloskan." };

  // Foto dokumentasi QC → storage (wajib saat loloskan).
  let qcPhotoKey: string | null = null;
  if (decision === "STOCK" && photo?.base64) {
    const mime = photo.mime || "image/jpeg";
    const key = makeKey("qc", mime.includes("png") ? "png" : "jpg");
    try {
      await putObject(key, Buffer.from(photo.base64, "base64"), mime);
      qcPhotoKey = key;
    } catch {
      return { ok: false, message: "Gagal simpan foto QC. Coba lagi." };
    }
  }

  // QC boleh ubah semua kecuali brand (merek).
  const data =
    decision === "STOCK"
      ? {
          status: "STOCK" as const,
          qcById: ctx.userId,
          qcAt: new Date(),
          qcPhotoKey,
          name: clean(edits?.name, 200) ?? p.name,
          color: clean(edits?.color, 40),
          size: clean(edits?.size, 40),
          sku: clean(edits?.sku, 60),
          unit: edits?.unit?.trim() || null,
          sellPrice: edits?.sellPrice != null ? Math.max(0, Math.round(edits.sellPrice)) : p.sellPrice,
          supplier: edits?.supplier?.trim() || null,
          qty: Math.max(1, Math.round(edits?.qty ?? p.qty) || 1),
        }
      : { status: "REJECTED" as const, qcById: ctx.userId, qcAt: new Date() };
  await prisma.rawProduct.update({ where: { id }, data });
  // Produk lolos QC otomatis masuk ke daftar barang media (konten). Media set kategori + tier lalu jadwalkan.
  if (decision === "STOCK") {
    await prisma.mediaItem.upsert({
      where: { sourceRawId: id },
      update: {}, // sudah ada: jangan timpa editan media
      create: {
        name: clean(edits?.name, 200) ?? p.name,
        color: clean(edits?.color, 40),
        qty: Math.max(1, Math.round(edits?.qty ?? p.qty) || 1),
        arrived: dateKeyWIB(new Date()),
        sourceRawId: id,
        createdById: ctx.userId,
      },
    });
  }
  const { ip } = await clientMeta();
  await logActivity(
    { ...ctx, ip },
    { action: decision === "STOCK" ? "qc_pass" : "qc_reject", entity: "RawProduct", entityId: id },
  );
  await notifyBosses(
    decision === "STOCK"
      ? { type: "qc_pass", title: `Produk lolos QC → Stok: ${p.name}`, link: "/stok" }
      : { type: "qc_reject", title: `Produk ditolak QC: ${p.name}`, link: "/stok/qc" },
  );
  return { ok: true };
}
