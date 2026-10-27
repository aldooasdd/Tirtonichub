import { prisma } from "@/server/db";
import { SHIFTS, isShiftCode, type ShiftCode } from "@/lib/shift";
import { defaultShift } from "@/lib/shift-default";

/** Jadwal shift kerja hari itu (start+end "HH:MM"). null = non-kerja/tak terjadwal → tak absen.
 *  Saved Shift menimpa pola PDF (defaultShift). */
export async function shiftScheduleFor(
  user: { id: string; fullName: string },
  dateKey: Date,
): Promise<{ start: string; end: string } | null> {
  const row = await prisma.shift.findUnique({
    where: { userId_date: { userId: user.id, date: dateKey } },
    select: { code: true },
  });
  const code = row?.code ?? defaultShift(user.fullName, dateKey.getUTCDate());
  if (!code || !isShiftCode(code)) return null;
  const def = SHIFTS[code as ShiftCode];
  if (!def.working || !def.start || !def.end) return null;
  return { start: def.start, end: def.end };
}
