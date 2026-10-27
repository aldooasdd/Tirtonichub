"use server";

import { prisma } from "@/server/db";
import { requireHr } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { isShiftCode } from "@/lib/shift";

export type ActionResult = { ok: boolean; message?: string };
export type Cell = { userId: string; day: number; code: string }; // code "" → hapus

const ymRe = /^\d{4}-\d{2}$/;

/** Simpan sel jadwal 1 bulan (HR). code kosong → hapus shift tsb. */
export async function saveShifts(ym: string, cells: Cell[]): Promise<ActionResult> {
  const ctx = await requireHr();
  if (!ymRe.test(ym)) return { ok: false, message: "Bulan tidak valid." };
  if (!Array.isArray(cells) || cells.length === 0) return { ok: true };

  const [y, m] = ym.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // hari dlm bulan

  const ops = [];
  for (const c of cells) {
    if (!c.userId || c.day < 1 || c.day > dim) continue;
    const date = new Date(Date.UTC(y, m - 1, c.day));
    if (!c.code) {
      ops.push(prisma.shift.deleteMany({ where: { userId: c.userId, date } }));
    } else if (isShiftCode(c.code)) {
      ops.push(
        prisma.shift.upsert({
          where: { userId_date: { userId: c.userId, date } },
          create: { userId: c.userId, date, code: c.code },
          update: { code: c.code },
        }),
      );
    }
  }
  if (ops.length === 0) return { ok: true };
  await prisma.$transaction(ops);

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "shift_save", entity: "Shift", entityId: `${ym}:${ops.length}` });
  return { ok: true };
}
