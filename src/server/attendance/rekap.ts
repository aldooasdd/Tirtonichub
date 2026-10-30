import { prisma } from "@/server/db";
import { SHIFTS, isShiftCode, type ShiftCode } from "@/lib/shift";
import { defaultShift } from "@/lib/shift-default";
import { parseHHMM, wibMinutesOfDay } from "@/server/attendance/logic";

export type DailyRow = {
  userId: string;
  name: string;
  branch: string | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: string;
  lateMinutes: number;
  earlyMinutes: number; // menit masuk sebelum jam shift (absen awal, maks 60)
  jadwal: string | null; // "HH:MM–HH:MM" shift kerja hari itu
  checkInLat: number | null;
  checkInLng: number | null;
  checkInPhotoKey: string | null;
};

const attendingUsers = {
  isActive: true,
  roles: { some: { role: { code: { not: "BOSS" as const } } } },
};

/** Rekap absen satu hari (semua karyawan yang wajib absen), opsional filter cabang. */
export async function dailyRekap(date: Date, branchId?: string) {
  const users = await prisma.user.findMany({
    where: { ...attendingUsers, ...(branchId ? { branchId } : {}) },
    include: { branch: true },
    orderBy: { fullName: "asc" },
  });
  const ids = users.map((u) => u.id);
  const [atts, holiday, shifts] = await Promise.all([
    prisma.attendance.findMany({ where: { date, userId: { in: ids } } }),
    prisma.holiday.findUnique({ where: { date } }),
    prisma.shift.findMany({ where: { date, userId: { in: ids } }, select: { userId: true, code: true } }),
  ]);
  const byUser = new Map(atts.map((a) => [a.userId, a]));
  const shiftByUser = new Map(shifts.map((s) => [s.userId, s.code]));
  const day = date.getUTCDate();

  // Shift kerja efektif hari itu (Shift tersimpan ?? pola PDF).
  const defFor = (u: { id: string; fullName: string }) => {
    const code = shiftByUser.get(u.id) ?? defaultShift(u.fullName, day, date.getUTCDay());
    return code && isShiftCode(code) ? SHIFTS[code as ShiftCode] : null;
  };

  const rows: DailyRow[] = users.map((u) => {
    const a = byUser.get(u.id);
    const def = defFor(u);
    const status = a?.status ?? (holiday ? "HOLIDAY" : def?.working ? "ABSENT" : "OFF");
    // Menit absen awal: hanya saat tepat waktu & masuk sebelum jam shift.
    let earlyMinutes = 0;
    if (a?.checkInAt && a.status === "ON_TIME" && def?.working && def.start) {
      const diff = parseHHMM(def.start) - wibMinutesOfDay(a.checkInAt);
      if (diff > 0) earlyMinutes = diff;
    }
    return {
      userId: u.id,
      name: u.fullName,
      branch: u.branch?.name ?? null,
      checkInAt: a?.checkInAt ?? null,
      checkOutAt: a?.checkOutAt ?? null,
      status,
      lateMinutes: a?.lateMinutes ?? 0,
      earlyMinutes,
      jadwal: def?.working && def.start && def.end ? `${def.start}–${def.end}` : null,
      checkInLat: a?.checkInLat ?? null,
      checkInLng: a?.checkInLng ?? null,
      checkInPhotoKey: a?.checkInPhotoKey ?? null,
    };
  });

  const summary = {
    onTime: rows.filter((r) => r.status === "ON_TIME").length,
    late: rows.filter((r) => r.status === "LATE").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
    permit: rows.filter((r) => r.status === "PERMIT").length,
    sick: rows.filter((r) => r.status === "SICK").length,
    leave: rows.filter((r) => r.status === "LEAVE").length,
    holiday: rows.filter((r) => r.status === "HOLIDAY").length,
  };
  return { rows, summary, isHoliday: !!holiday };
}

export type MonthlyRow = {
  userId: string;
  name: string;
  hadir: number;
  telat: number;
  telatMenit: number;
  izin: number;
  sakit: number;
  cuti: number;
  totalJam: number;
};

export async function monthlyRekap(year: number, month: number, branchId?: string) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const users = await prisma.user.findMany({
    where: { ...attendingUsers, ...(branchId ? { branchId } : {}) },
    orderBy: { fullName: "asc" },
  });
  const atts = await prisma.attendance.findMany({
    where: { userId: { in: users.map((u) => u.id) }, date: { gte: start, lt: end } },
  });
  const byUser = new Map<string, typeof atts>();
  for (const a of atts) {
    const arr = byUser.get(a.userId) ?? [];
    arr.push(a);
    byUser.set(a.userId, arr);
  }

  const rows: MonthlyRow[] = users.map((u) => {
    const list = byUser.get(u.id) ?? [];
    let hadir = 0,
      telat = 0,
      telatMenit = 0,
      izin = 0,
      sakit = 0,
      cuti = 0,
      totalMs = 0;
    for (const a of list) {
      if (a.status === "ON_TIME" || a.status === "LATE") hadir++;
      if (a.status === "LATE") {
        telat++;
        telatMenit += a.lateMinutes;
      }
      if (a.status === "PERMIT") izin++;
      if (a.status === "SICK") sakit++;
      if (a.status === "LEAVE") cuti++;
      if (a.checkInAt && a.checkOutAt) totalMs += a.checkOutAt.getTime() - a.checkInAt.getTime();
    }
    return {
      userId: u.id,
      name: u.fullName,
      hadir,
      telat,
      telatMenit,
      izin,
      sakit,
      cuti,
      totalJam: Math.round((totalMs / 3_600_000) * 10) / 10,
    };
  });
  return rows;
}
