"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth/rbac";
import { dateKeyWIB } from "@/server/attendance/logic";
import { effectiveShiftCode } from "@/server/attendance/shift-schedule";
import { kasirShift, SHIFT_LABEL } from "@/lib/cash";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";

export type ActionResult = { ok: boolean; message?: string };
type Amounts = { cash: number; mandiri: number; bca: number; bri: number };

const int = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

/** Shift kasir user hari ini dari jadwal (P/LONG=Pagi, S=Siang). null bila bukan shift toko. */
async function myShift(userId: string, date: Date) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  if (!u) return null;
  return kasirShift(await effectiveShiftCode({ id: userId, fullName: u.fullName }, date));
}

/** Buka saldo kasir shift-nya (laci + 3 EDC) setelah absen masuk. 1 orang per shift. */
export async function openCashSession(a: Amounts): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.branchId) return { ok: false, message: "Akun tak punya cabang." };
  const date = dateKeyWIB(new Date());
  const shift = await myShift(ctx.userId, date);
  if (!shift) return { ok: false, message: "Jadwal kamu hari ini bukan shift toko (Pagi/Siang), tak bisa buka kasir." };
  const exists = await prisma.cashSession.findUnique({ where: { branchId_date_shift: { branchId: ctx.branchId, date, shift } } });
  if (exists) return { ok: false, message: `Kasir shift ${SHIFT_LABEL[shift]} sudah dibuka.` };

  await prisma.cashSession.create({
    data: {
      branchId: ctx.branchId,
      date,
      shift,
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

/** Tutup saldo kasir shift-nya (hitung fisik cash + 3 EDC). Hanya yang buka boleh tutup. */
export async function closeCashSession(a: Amounts): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (!ctx.branchId) return { ok: false, message: "Akun tak punya cabang." };
  const date = dateKeyWIB(new Date());
  const shift = await myShift(ctx.userId, date);
  if (!shift) return { ok: false, message: "Jadwal kamu hari ini bukan shift toko (Pagi/Siang)." };
  const sess = await prisma.cashSession.findUnique({ where: { branchId_date_shift: { branchId: ctx.branchId, date, shift } } });
  if (!sess) return { ok: false, message: `Kasir shift ${SHIFT_LABEL[shift]} belum dibuka.` };
  if (sess.openedById !== ctx.userId) return { ok: false, message: "Hanya yang buka kasir boleh menutup." };
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
