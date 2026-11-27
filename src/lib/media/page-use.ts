/** Pemakaian halaman Studio (keputusan Zaki 23 Nov 2026, hanya dilihat admin penuh). */
export const USE_PAGES: Record<string, string> = {
  home: "Dashboard",
  masuk: "Barang",
  idcc: "IDCC",
  pipeline: "FlowSpace",
  fsnew: "FlowSpace baru",
  "card:det": "Detail kartu",
  "card:brief": "Content Brief",
  "card:qa": "Creative Review",
  queue: "Konten",
  script: "Script Konten",
  kal: "Kalender",
  hasil: "File",
  jumat: "Laporan",
  cpr: "CPR",
  otomasi: "Otomasi",
  tim: "Tim & Aktivitas",
};
export const isUsePage = (p: unknown): p is string => typeof p === "string" && Object.prototype.hasOwnProperty.call(USE_PAGES, p);

/** Tanggal WIB (YYYY-MM-DD) n hari sebelum `at`. */
export function wibDay(at: number, back = 0): string {
  return new Date(at + 7 * 3600_000 - back * 86_400_000).toISOString().slice(0, 10);
}

export type UseRow = { userId: string; day: string; page: string; n: number; lastAt: number };
export type UseCell = { days: number; n: number; lastAt: number };

/** Ringkas baris harian → per orang × halaman: jumlah hari dipakai, jumlah buka, terakhir buka. */
export function summarize(rows: UseRow[]): Record<string, Record<string, UseCell>> {
  const out: Record<string, Record<string, UseCell>> = {};
  for (const r of rows) {
    if (!isUsePage(r.page)) continue;
    const c = ((out[r.userId] ??= {})[r.page] ??= { days: 0, n: 0, lastAt: 0 });
    c.days += 1;
    c.n += r.n;
    c.lastAt = Math.max(c.lastAt, r.lastAt);
  }
  return out;
}
