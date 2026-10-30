"use server";

import { prisma } from "@/server/db";
import { requireCashoutInput, requireFinance } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyBosses, notifyRole } from "@/server/notify";
import { parseSalesNotaViaN8n } from "@/server/n8n-sales";
import { parseWIB } from "@/lib/datetime";

export type ActionResult = { ok: boolean; message?: string };

type SaveInput = {
  amount: number;
  description: string;
  spentAt?: string | null; // ISO; kosong → sekarang
  category?: string | null;
  photoKey?: string | null; // foto nota hasil scan (sudah diupload)
  imageBase64?: string | null; // atau foto mentah (diupload saat simpan)
  mimeType?: string | null;
};

export type CashoutScan = {
  ok: boolean;
  message?: string;
  photoKey?: string;
  parsed?: { amount: number; description: string; spentAt: string | null };
  ocr?: boolean; // true bila n8n mengisi
};

const rupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

/** Scan foto nota pembelian via OCR (sama seperti nota penjualan). Belum simpan DB (diedit dulu). */
export async function scanCashoutNota(imageBase64: string, mimeType: string): Promise<CashoutScan> {
  await requireCashoutInput();
  if (!imageBase64) return { ok: false, message: "Foto nota kosong." };

  const key = makeKey("cashout-nota", mimeType.includes("png") ? "png" : "jpg");
  try {
    await putObject(key, Buffer.from(imageBase64, "base64"), mimeType || "image/jpeg");
  } catch {
    return { ok: false, message: "Gagal simpan foto nota." };
  }

  const parsed = await parseSalesNotaViaN8n(imageBase64, mimeType);
  const amount = parsed ? parsed.grandTotal || parsed.total || 0 : 0;
  const description = parsed
    ? parsed.items
        .filter((i) => i.name?.trim())
        .map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name))
        .join(", ")
        .slice(0, 500)
    : "";
  return { ok: true, photoKey: key, parsed: { amount, description, spentAt: parsed?.soldAt ?? null }, ocr: parsed !== null };
}

/** Sales: input pengeluaran/pembelian → perlu ACC Kepala Cabang cabangnya, lalu masuk Finance. */
export async function saveCashout(input: SaveInput): Promise<ActionResult> {
  const ctx = await requireCashoutInput();
  const amount = Math.max(0, Math.round(input.amount) || 0);
  const description = input.description?.trim();
  const category = input.category?.trim();
  if (!category) return { ok: false, message: "Pilih jenis pembelian." };
  if (amount <= 0) return { ok: false, message: "Jumlah harus lebih dari 0." };
  if (!description) return { ok: false, message: "Keterangan wajib diisi." };

  // Cabang yang mengeluarkan uang = cabang user pengirim.
  const br = ctx.branchId
    ? await prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { name: true } })
    : null;

  let photoKey: string | null = input.photoKey ?? null;
  if (!photoKey && input.imageBase64) {
    photoKey = makeKey("cashout-nota", (input.mimeType ?? "").includes("png") ? "png" : "jpg");
    try {
      await putObject(photoKey, Buffer.from(input.imageBase64, "base64"), input.mimeType || "image/jpeg");
    } catch {
      return { ok: false, message: "Gagal simpan foto nota." };
    }
  }

  const spentAt = input.spentAt && !Number.isNaN(Date.parse(input.spentAt)) ? parseWIB(input.spentAt) : new Date();

  const row = await prisma.cashout.create({
    data: {
      spentAt,
      amount,
      description: description.slice(0, 500),
      category: input.category?.trim()?.slice(0, 60) || null,
      branchId: ctx.branchId ?? null,
      branchName: br?.name ?? null,
      photoKey,
      createdById: ctx.userId,
      // Langsung masuk rekap Finance tanpa approval.
      approvedAt: new Date(),
      approvedById: ctx.userId,
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cashout_input", entity: "Cashout", entityId: row.id });
  await notifyRole("FINANCE", {
    type: "cashout_input",
    title: `Pengeluaran masuk rekap: Rp ${rupiah(amount)}`,
    link: "/finance/pembelian",
  });
  return { ok: true };
}

/** Finance/Boss/Admin: setujui pengeluaran → masuk rekap pembelian Finance. */
export async function approveCashout(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!id) return { ok: false, message: "ID kosong." };
  const row = await prisma.cashout.findUnique({
    where: { id },
    select: { id: true, branchId: true, approvedAt: true, amount: true },
  });
  if (!row) return { ok: false, message: "Tidak ditemukan." };
  if (row.approvedAt) return { ok: false, message: "Sudah disetujui." };

  await prisma.cashout.update({ where: { id }, data: { approvedAt: new Date(), approvedById: ctx.userId } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cashout_approve", entity: "Cashout", entityId: id });
  await notifyBosses({ type: "cashout", title: `Pengeluaran disetujui cabang: Rp ${rupiah(row.amount)}`, link: "/finance/pembelian" });
  return { ok: true };
}

/** Finance/Boss/Admin: tolak pengeluaran (hapus). */
export async function rejectCashout(id: string): Promise<ActionResult> {
  const ctx = await requireFinance();
  if (!id) return { ok: false, message: "ID kosong." };
  const row = await prisma.cashout.findUnique({ where: { id }, select: { id: true, approvedAt: true } });
  if (!row) return { ok: false, message: "Tidak ditemukan." };
  if (row.approvedAt) return { ok: false, message: "Sudah disetujui, tak bisa ditolak." };

  await prisma.cashout.delete({ where: { id } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cashout_reject", entity: "Cashout", entityId: id });
  return { ok: true };
}
