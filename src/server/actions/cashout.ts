"use server";

import { prisma } from "@/server/db";
import { requireSalesInput, requireFinance } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyBosses, notifyRole } from "@/server/notify";

export type ActionResult = { ok: boolean; message?: string };

type SaveInput = {
  amount: number;
  description: string;
  spentAt?: string | null; // ISO; kosong → sekarang
  category?: string | null;
  imageBase64?: string | null; // foto nota pembelian (opsional)
  mimeType?: string | null;
};

const rupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

/** Sales: input pengeluaran/pembelian → perlu ACC Kepala Cabang cabangnya, lalu masuk Finance. */
export async function saveCashout(input: SaveInput): Promise<ActionResult> {
  const ctx = await requireSalesInput();
  const amount = Math.max(0, Math.round(input.amount) || 0);
  const description = input.description?.trim();
  if (amount <= 0) return { ok: false, message: "Jumlah harus lebih dari 0." };
  if (!description) return { ok: false, message: "Keterangan wajib diisi." };

  // Cabang yang mengeluarkan uang = cabang user pengirim.
  const br = ctx.branchId
    ? await prisma.branch.findUnique({ where: { id: ctx.branchId }, select: { name: true } })
    : null;

  let photoKey: string | null = null;
  if (input.imageBase64) {
    photoKey = makeKey("cashout-nota", (input.mimeType ?? "").includes("png") ? "png" : "jpg");
    try {
      await putObject(photoKey, Buffer.from(input.imageBase64, "base64"), input.mimeType || "image/jpeg");
    } catch {
      return { ok: false, message: "Gagal simpan foto nota." };
    }
  }

  const spentAt = input.spentAt && !Number.isNaN(Date.parse(input.spentAt)) ? new Date(input.spentAt) : new Date();

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
    },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cashout_input", entity: "Cashout", entityId: row.id });
  await notifyRole("FINANCE", {
    type: "cashout_pending",
    title: `Pengeluaran perlu ACC: Rp ${rupiah(amount)}`,
    link: "/cabang/pembelian",
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
