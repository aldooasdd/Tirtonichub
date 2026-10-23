// Logika absensi murni (tanpa DB). Semua perhitungan "hari"/jam pakai WIB (UTC+7). PRD §16.

const WIB_OFFSET_MS = 7 * 3600 * 1000;

function wibShift(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

/** Kunci tanggal WIB sebagai Date (UTC midnight dari Y-M-D WIB), untuk Attendance.date. */
export function dateKeyWIB(date: Date): Date {
  const w = wibShift(date);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
}

/** Hari dalam minggu WIB: 1=Senin .. 7=Minggu. */
export function wibWeekday(date: Date): number {
  const d = wibShift(date).getUTCDay(); // 0=Minggu..6=Sabtu
  return d === 0 ? 7 : d;
}

/** Menit sejak tengah malam WIB. */
export function wibMinutesOfDay(date: Date): number {
  const w = wibShift(date);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export type CheckInStatus = { status: "ON_TIME" | "LATE"; lateMinutes: number };

/** Status check-in terhadap jadwal (jam masuk + toleransi). */
export function computeCheckInStatus(
  checkInAt: Date,
  schedule: { startTime: string; lateToleranceMin: number },
): CheckInStatus {
  const nowMin = wibMinutesOfDay(checkInAt);
  const startMin = parseHHMM(schedule.startTime);
  const late = nowMin > startMin + schedule.lateToleranceMin;
  return { status: late ? "LATE" : "ON_TIME", lateMinutes: late ? nowMin - startMin : 0 };
}

/** Jarak haversine (meter). */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Cek radius absen. Tolak hanya jika (jarak − akurasiGPS) > radius (toleransi akurasi). §8.2 */
export function withinRadius(
  point: { lat: number; lng: number; accuracy: number },
  branch: { lat: number; lng: number },
  radiusM: number,
): { ok: boolean; distance: number } {
  const distance = haversine(point.lat, point.lng, branch.lat, branch.lng);
  return { ok: distance - point.accuracy <= radiusM, distance };
}
