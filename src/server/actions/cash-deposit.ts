"use server";

import { prisma } from "@/server/db";
import { requireHeadBranch } from "@/server/auth/rbac";
import { isSuperRole } from "@/lib/roles";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { makeKey, putObject } from "@/server/storage";
import { notifyRole } from "@/server/notify";
import { parseWIB } from "@/lib/datetime";
import { SETOR_AKUN } from "@/lib/rekening";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Kepala Cabang: setor tunai dari laci cabang ke rekening BCA OP - Ridho (wajib bukti).
 *  Mengurangi cash laci di Saldo Kasir & tampil di Rekap Rekening. */
export async function saveCashDeposit(input: {
  amount: number;
  depositedAt?: string | null; // datetime-local WIB; kosong = sekarang
  branchId?: string | null; // hanya Boss/Admin boleh pilih; Kepala Cabang = cabangnya sendiri
  imageBase64: string;
  mimeType: string;
}): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireHeadBranch();
  const amount = Math.max(0, Math.round(input.amount) || 0);
  if (amount <= 0) return { ok: false, message: "Nominal harus lebih dari 0." };
  if (!input.imageBase64) return { ok: false, message: "Bukti setor wajib diupload." };

  const branchId = isSuperRole(ctx.activeRole) ? input.branchId || ctx.branchId : ctx.branchId;
  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } }) : null;
  if (!branch) return { ok: false, message: "Cabang tidak ditemukan. Pastikan akunmu terdaftar di cabang." };

  const buf = Buffer.from(input.imageBase64, "base64");
  if (buf.length > MAX_PHOTO_BYTES) return { ok: false, message: "File bukti terlalu besar (maks 8 MB)." };
  const isPdf = input.mimeType.includes("pdf");
  const photoKey = makeKey("setor-tunai", isPdf ? "pdf" : input.mimeType.includes("png") ? "png" : "jpg");
  try {
    await putObject(photoKey, buf, input.mimeType || "image/jpeg");
  } catch {
    return { ok: false, message: "Gagal simpan bukti setor." };
  }

  const depositedAt =
    input.depositedAt && !Number.isNaN(Date.parse(input.depositedAt)) ? parseWIB(input.depositedAt) : new Date();
  const row = await prisma.cashDeposit.create({
    data: { branchId: branch.id, branchName: branch.name, amount, photoKey, depositedAt, createdById: ctx.userId },
  });

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cash_deposit", entity: "CashDeposit", entityId: row.id, after: { amount, branch: branch.name } });
  await notifyRole("FINANCE", {
    type: "cash_deposit",
    title: `Setor tunai ${branch.name}: Rp ${new Intl.NumberFormat("id-ID").format(amount)} → ${SETOR_AKUN}`,
    link: "/finance/rekening",
  });
  return { ok: true };
}
