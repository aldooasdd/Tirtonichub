// Siapa yang membuka UI Studio: sesi Tirtonichub + data MediaMember + status absen hari ini.

import { prisma } from "@/server/db";
import { getSession } from "@/server/auth/session";
import { dateKeyWIB, wibWeekday } from "@/server/attendance/logic";
import type { StudioUser } from "./rules";

export type StudioCtx =
  | { ok: true; u: StudioUser; attend: { need: boolean; done: boolean } }
  | { ok: false; status: 401 | 403; code: "login" | "not_member" };

export async function studioCtx(): Promise<StudioCtx> {
  const s = await getSession();
  if (!s) return { ok: false, status: 401, code: "login" };
  const m = await prisma.mediaMember.findUnique({ where: { userId: s.user.id } });
  const boss = s.roles.includes("BOSS");
  if (!m && !boss) return { ok: false, status: 403, code: "not_member" };
  const full = boss || m?.role === "ADMIN";
  const staff = full || m?.role === "ADMIN2";
  const u: StudioUser = {
    userId: s.user.id,
    email: s.user.email.toLowerCase(),
    name: s.user.fullName,
    code: m && !m.code.startsWith("~") ? m.code : "",
    full,
    staff,
    idcc: staff || !!m?.idcc,
  };
  // Wajib absen = punya peran selain BOSS (aturan sistem pusat). Cuti/sakit/izin/libur tercatat juga dianggap sudah.
  // Hari libur pribadi (MediaMember.offDays, 0=Min…6=Sab) dan tanggal merah (Holiday) tidak wajib absen.
  const now = new Date();
  const offToday = !!m && (m.offDays ?? []).includes(wibWeekday(now) % 7);
  const holiday = !offToday && !!(await prisma.holiday.findUnique({ where: { date: dateKeyWIB(now) }, select: { id: true } }));
  // Wajib absen sementara DIMATIKAN (permintaan Zaki, 26 Okt 2026). Nyalakan dengan STUDIO_WAJIB_ABSEN=1 di .env server.
  const enforce = process.env.STUDIO_WAJIB_ABSEN === "1";
  const need = enforce && s.roles.some((r) => r !== "BOSS") && !offToday && !holiday;
  let done = !need;
  if (need) {
    const a = await prisma.attendance.findUnique({ where: { userId_date: { userId: s.user.id, date: dateKeyWIB(new Date()) } }, select: { checkInAt: true, status: true } });
    done = !!a && (!!a.checkInAt || ["LEAVE", "SICK", "PERMIT", "HOLIDAY"].includes(a.status));
  }
  return { ok: true, u, attend: { need, done } };
}
