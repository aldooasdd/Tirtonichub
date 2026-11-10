// Catatan perubahan jadwal per kartu (tasks.extra.planLog), sejak 9 Nov 2026.
// Ditulis HANYA oleh server, setiap kali Rencana syuting (shootPlan) atau Rencana edit (editPlan) berubah,
// dari Studio (store.ts) maupun dasbor (/media/workflow, media-tasks.ts). Isian dari klien selalu diabaikan,
// jadi catatan tidak bisa dipalsukan atau dihapus lewat Studio. Tampil di Detail kartu Studio ("Riwayat jadwal").

export const PLAN_FIELDS = ["shootPlan", "editPlan"] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];
/** from '' = rencana awal saat kartu dibuat; to '' = tanggal dikosongkan. src: 'studio' | 'dasbor'. */
export type PlanLogEntry = { at: number; by: string; f: PlanField; from: string; to: string; src: string };
export const PLAN_LOG_MAX = 40;

const s = (v: unknown) => (v == null ? "" : String(v));

/** Catatan lama dari data yang tersimpan (abaikan isi yang tidak sah). */
export function planLogOf(v: unknown): PlanLogEntry[] {
  return Array.isArray(v) ? (v.filter((e) => e && typeof e === "object" && PLAN_FIELDS.includes((e as PlanLogEntry).f)) as PlanLogEntry[]) : [];
}

/**
 * Catatan baru = catatan tersimpan (`prev`, bukan kiriman klien) + satu baris per tanggal yang berubah.
 * `before` null = kartu baru: tanggal yang terisi dicatat sebagai rencana awal.
 * Mengembalikan undefined bila tetap kosong.
 */
export function nextPlanLog(
  prev: unknown,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  by: string,
  src: string,
  at = Date.now(),
): PlanLogEntry[] | undefined {
  const log = planLogOf(prev);
  for (const f of PLAN_FIELDS) {
    const from = before ? s(before[f]) : "";
    const to = s(after[f]);
    if (from !== to) log.push({ at, by: by || "?", f, from, to, src });
  }
  return log.length ? log.slice(-PLAN_LOG_MAX) : undefined;
}
