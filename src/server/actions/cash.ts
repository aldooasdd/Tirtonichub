"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";

export type ActionResult = { ok: boolean; message?: string };
type Amounts = { cash: number; mandiri: number; bca: number; bri: number };

const int = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

/** Sales pertama: buka saldo kasir cabang (laci + 3 EDC) setelah absen masuk. */
export async function openCashSession(a: Amounts): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.branchId) return { ok: false, message: "Akun tak punya cabang." };
  const date = dateKeyWIB(new Date());
  const exists = await prisma.cashSession.findUnique({ where: { branchId_date: { branchId: ctx.branchId, date } } });
  if (exists) return { ok: false, message: "Saldo kasir hari ini sudah dibuka." };

  await prisma.cashSession.create({
    data: {
      branchId: ctx.branchId,
      date,
      openCash: int(a.cash),
      openMandiri: int(a.mandiri),
      openBca: int(a.bca),
      openBri: int(a.bri),
      openedById: ctx.userId,
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cash_open", entity: "CashSession" });
  revalidatePath("/beranda");
  return { ok: true };
}

/** Sebelum absen pulang: tutup saldo kasir (hitung fisik cash + 3 EDC). */
export async function closeCashSession(a: Amounts): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.branchId) return { ok: false, message: "Akun tak punya cabang." };
  const date = dateKeyWIB(new Date());
  const sess = await prisma.cashSession.findUnique({ where: { branchId_date: { branchId: ctx.branchId, date } } });
  if (!sess) return { ok: false, message: "Saldo kasir belum dibuka." };
  if (sess.closedAt) return { ok: false, message: "Saldo kasir sudah ditutup." };

  await prisma.cashSession.update({
    where: { id: sess.id },
    data: {
      closeCash: int(a.cash),
      closeMandiri: int(a.mandiri),
      closeBca: int(a.bca),
      closeBri: int(a.bri),
      closedById: ctx.userId,
      closedAt: new Date(),
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "cash_close", entity: "CashSession", entityId: sess.id });
  revalidatePath("/beranda");
  return { ok: true };
}
