"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireHr } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { isShiftCode } from "@/lib/shift";
import { defaultShift } from "@/lib/shift-default";

export type ActionResult = { ok: boolean; message?: string };
export type Cell = { userId: string; day: number; code: string }; // code "" → hapus

const ymRe = /^\d{4}-\d{2}$/;
const MIN_SALES_PER_SHIFT = 2; // tiap hari: shift P & S masing-masing min 2 sales

/** Simpan sel jadwal 1 bulan (HR). code kosong → hapus shift tsb. */
export async function saveShifts(ym: string, cells: Cell[]): Promise<ActionResult> {
  const ctx = await requireHr();
  if (!ymRe.test(ym)) return { ok: false, message: "Bulan tidak valid." };
  if (!Array.isArray(cells) || cells.length === 0) return { ok: true };

  const [y, m] = ym.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // hari dlm bulan

  const editByKey = new Map<string, string>(); // `${userId}:${day}` → code baru
  const ops = [];
  for (const c of cells) {
    if (!c.userId || c.day < 1 || c.day > dim) continue;
    if (c.code && !isShiftCode(c.code)) continue;
    editByKey.set(`${c.userId}:${c.day}`, c.code);
    const date = new Date(Date.UTC(y, m - 1, c.day));
    if (!c.code) {
      ops.push(prisma.shift.deleteMany({ where: { userId: c.userId, date } }));
    } else {
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

  const violation = await checkSalesRule(y, m, editByKey);
  if (violation) return { ok: false, message: violation };

  await prisma.$transaction(ops);

  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "shift_save", entity: "Shift", entityId: `${ym}:${ops.length}` });
  revalidatePath("/beranda"); // dashboard karyawan ikut jadwal terbaru
  revalidatePath("/hr/jadwal");
  return { ok: true };
}

// Validasi aturan sales. Hanya cek hari yg edit-nya menyentuh karyawan SALES.
// Efektif = edit (kalau ada; kosong → balik ke default PDF) || shift tersimpan || default PDF.
async function checkSalesRule(
  y: number,
  m: number,
  editByKey: Map<string, string>,
): Promise<string | null> {
  const editedIds = [...new Set([...editByKey.keys()].map((k) => k.split(":")[0]))];
  const editedUsers = await prisma.user.findMany({
    where: { id: { in: editedIds } },
    select: { id: true, branchId: true, roles: { select: { role: { select: { code: true } } } } },
  });
  const salesEdited = new Set(
    editedUsers.filter((u) => u.roles.some((r) => r.role.code === "SALES")).map((u) => u.id),
  );
  if (salesEdited.size === 0) return null;

  // cabang → hari terdampak
  const affected = new Map<string, Set<number>>();
  for (const k of editByKey.keys()) {
    const [uid, dayStr] = k.split(":");
    if (!salesEdited.has(uid)) continue;
    const bid = editedUsers.find((u) => u.id === uid)?.branchId;
    if (!bid) continue;
    if (!affected.has(bid)) affected.set(bid, new Set());
    affected.get(bid)!.add(Number(dayStr));
  }
  if (affected.size === 0) return null;

  const sales = await prisma.user.findMany({
    where: { isActive: true, branchId: { in: [...affected.keys()] }, roles: { some: { role: { code: "SALES" } } } },
    select: { id: true, fullName: true, branchId: true },
  });
  const allDays = new Set<number>();
  affected.forEach((ds) => ds.forEach((d) => allDays.add(d)));
  const dates = [...allDays].map((d) => new Date(Date.UTC(y, m - 1, d)));
  const saved = await prisma.shift.findMany({
    where: { userId: { in: sales.map((s) => s.id) }, date: { in: dates } },
    select: { userId: true, date: true, code: true },
  });
  const savedMap = new Map<string, string>();
  for (const s of saved) savedMap.set(`${s.userId}:${s.date.getUTCDate()}`, s.code);

  const eff = (u: { id: string; fullName: string }, day: number): string => {
    const k = `${u.id}:${day}`;
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (editByKey.has(k)) return editByKey.get(k)! || defaultShift(u.fullName, day, dow);
    return savedMap.get(k) ?? defaultShift(u.fullName, day, dow);
  };

  for (const [bid, days] of affected) {
    const branchSales = sales.filter((s) => s.branchId === bid);
    for (const day of [...days].sort((a, b) => a - b)) {
      let p = 0;
      let s = 0;
      for (const u of branchSales) {
        const c = eff(u, day);
        if (c === "P") p++;
        else if (c === "S") s++;
      }
      if (p < MIN_SALES_PER_SHIFT || s < MIN_SALES_PER_SHIFT) {
        return `Tgl ${day}: Pagi ${p} & Siang ${s} sales. Tiap shift wajib min ${MIN_SALES_PER_SHIFT}. Jadwal tidak disimpan.`;
      }
    }
  }
  return null;
}
