// Jadwal default per karyawan per HARI (bukan tanggal), dari PDF "Jadwal Tirtonic".
// Rota mingguan tetap: DES & NOV identik per orang, hanya beda hari tgl-1. Karena dipetakan
// per hari (Minggu..Sabtu), pola otomatis benar di SEMUA bulan. Grid HR menampilkannya
// otomatis; edit HR / approve tukar shift menimpanya sebagai row Shift per-tanggal, jadi cuma
// berlaku bulan itu — bulan lain tetap pola ini. match = awalan nama (lowercase), sinkron DB.

type Row = { match: string; week: string }; // week = 7 kode: Minggu Senin Selasa Rabu Kamis Jumat Sabtu

// Andhin & Dea: PDF tulis OH di hari kerja, tapi diminta jadi P. Sabtu WFH, Minggu O.
const ROWS: Row[] = [
  // Jogja
  { match: "delfia", week: "S WFH O S P S P" },
  { match: "wimas", week: "P O WFH P S P S" },
  { match: "yopi", week: "S P S P O S P" },
  { match: "aldi", week: "P S P O S P S" },
  { match: "indy", week: "P S P S P O S" },
  { match: "edo", week: "S P O S P S P" },
  { match: "junita", week: "P O S P S P S" },
  { match: "dea", week: "O P P P P P WFH" },
  { match: "andhin", week: "O P P P P P WFH" },
  // Solo
  { match: "lala", week: "P S O S P P S" },
  { match: "mutia", week: "P S P S P O S" },
  { match: "ghifari", week: "P O S P S P S" },
  { match: "mawa", week: "S P P O S S P" },
  { match: "afi", week: "S P S P O S P" },
  // Semarang
  { match: "jose", week: "S O S S P P P" },
  { match: "nur taufiq", week: "P P P O S S S" },
  { match: "rahma", week: "P S S P O P S" },
  { match: "a taufiq", week: "S S P P P O S" },
  { match: "irfan", week: "P P O S S S P" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const table = ROWS.map((r) => ({ match: r.match, week: r.week.trim().split(/\s+/) }));

const rowFor = (fullName: string) => {
  const n = norm(fullName);
  return table.find((r) => n.startsWith(r.match));
};

/** Kode shift default utk nama + hari. dow = 0=Minggu..6=Sabtu. "" bila tak ada pola / dow null. */
export function defaultShift(fullName: string, _day: number, dow?: number): string {
  if (dow == null) return "";
  return rowFor(fullName)?.week[dow] ?? "";
}

/** True bila nama punya pola jadwal di PDF. */
export function hasShiftRow(fullName: string): boolean {
  return !!rowFor(fullName);
}
