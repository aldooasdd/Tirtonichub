import { prisma } from "@/server/db";
import { REQ_TYPE_LABEL } from "@/lib/request-labels";
import { SHIFTS, isShiftCode, type ShiftCode } from "@/lib/shift";
import { defaultShift } from "@/lib/shift-default";
import type { Event } from "@/components/ui/event-manager";

// Date @db.Date disimpan UTC midnight → bangun Date lokal pada hari yang sama.
function atDay(d: Date, hour = 9): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
}
function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (t <= e) {
    out.push(new Date(t));
    t += 86_400_000;
  }
  return out;
}

const REQ_COLOR: Record<string, string> = { LEAVE: "blue", PERMIT: "orange", SICK: "purple" };
const SHIFT_COLOR: Record<ShiftCode, string> = {
  P: "green", S: "blue", OH: "purple", LONG: "indigo", O: "red", WFH: "orange", CUTI: "blue", SAKIT: "purple", IZIN: "pink",
};

function atTime(y: number, mo: number, day: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(y, mo, day, h, m, 0, 0);
}

const SHIFT_MONTHS = 3; // bulan berjalan + 2 ke depan (biar navigasi kalender tetap terisi)

/** Event jadwal shift utk satu karyawan, 3 bulan ke depan (saved Shift timpa pola PDF).
 *  attendees = daftar karyawan yang kerja di hari sama (buat konfirmasi pengganti). */
async function shiftEvents(userId: string, fullName: string): Promise<Event[]> {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const y0 = wib.getUTCFullYear();
  const m0 = wib.getUTCMonth();
  const start = new Date(Date.UTC(y0, m0, 1));
  const end = new Date(Date.UTC(y0, m0 + SHIFT_MONTHS, 0)); // akhir bulan terakhir

  // Semua karyawan + shift tersimpan sekali, lalu hitung kode per hari di memori.
  const [users, rows] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true } }),
    prisma.shift.findMany({ where: { date: { gte: start, lte: end } }, select: { userId: true, date: true, code: true } }),
  ]);
  const saved = new Map<string, string>(); // "uid|y-mo-day" → code
  for (const r of rows) saved.set(`${r.userId}|${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}-${r.date.getUTCDate()}`, r.code);
  const codeOf = (uid: string, name: string, y: number, mo: number, day: number) =>
    saved.get(`${uid}|${y}-${mo}-${day}`) ?? defaultShift(name, day);

  const out: Event[] = [];
  for (let k = 0; k < SHIFT_MONTHS; k++) {
    const d0 = new Date(Date.UTC(y0, m0 + k, 1));
    const y = d0.getUTCFullYear();
    const mo = d0.getUTCMonth();
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    for (let day = 1; day <= dim; day++) {
      const code = codeOf(userId, fullName, y, mo, day);
      if (!code || !isShiftCode(code)) continue;
      const def = SHIFTS[code as ShiftCode];
      // roster hari itu: semua karyawan yang masuk kerja + kode shiftnya
      const roster: string[] = [];
      for (const u of users) {
        const c = codeOf(u.id, u.fullName, y, mo, day);
        if (c && isShiftCode(c) && SHIFTS[c as ShiftCode].working)
          roster.push(`${u.fullName} — ${SHIFTS[c as ShiftCode].label.split(" ")[0]}`);
      }
      out.push({
        id: `shift_${y}-${mo + 1}-${day}`,
        title: def.label.split(" ")[0], // kata singkat: Pagi/Siang/Office/Libur/WFH/Cuti/Sakit/Izin
        description: def.label, // lengkap + jam, tampil saat di-tap
        startTime: atTime(y, mo, day, def.start ?? "00:00"),
        endTime: atTime(y, mo, day, def.end ?? "23:59"),
        color: SHIFT_COLOR[code as ShiftCode] ?? "blue",
        category: "Jadwal",
        attendees: roster,
      });
    }
  }
  return out;
}

/** Gabungan event: manual (editable) + libur + cuti/izin/sakit (turunan, read-only). `me` → tambah jadwal shift pribadi. */
export async function loadCalendarEvents(me?: { userId: string; fullName: string }): Promise<Event[]> {
  const [manual, holidays, requests] = await Promise.all([
    prisma.calendarEvent.findMany({ orderBy: { startTime: "asc" } }),
    prisma.holiday.findMany(),
    prisma.request.findMany({
      where: { type: { in: ["LEAVE", "PERMIT", "SICK"] }, status: { in: ["APPROVED", "PENDING"] } },
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  const events: Event[] = [];

  for (const e of manual) {
    events.push({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      startTime: e.startTime,
      endTime: e.endTime,
      color: e.color,
      category: e.category ?? undefined,
      tags: e.tags,
    });
  }

  for (const h of holidays) {
    events.push({
      id: `hol_${h.id}`,
      title: h.name,
      startTime: atDay(h.date),
      endTime: atDay(h.date, 10),
      color: "red",
      category: "Libur",
    });
  }

  for (const r of requests) {
    const pending = r.status === "PENDING";
    for (const day of eachDay(r.startDate, r.endDate)) {
      events.push({
        id: `req_${r.id}_${day.toISOString().slice(0, 10)}`,
        title: `${REQ_TYPE_LABEL[r.type]} — ${r.user.fullName}${pending ? " (pending)" : ""}`,
        description: r.reason,
        startTime: atDay(day),
        endTime: atDay(day, 10),
        color: pending ? "pink" : (REQ_COLOR[r.type] ?? "blue"),
        category: pending ? "Pengajuan" : REQ_TYPE_LABEL[r.type],
      });
    }
  }

  if (me) events.push(...(await shiftEvents(me.userId, me.fullName)));

  return events;
}
