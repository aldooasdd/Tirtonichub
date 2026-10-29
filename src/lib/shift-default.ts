// Jadwal default per karyawan per tanggal (1..31), dari PDF "Jadwal Tirtonic - DES"
// (Des = 31 hari, dipakai sebagai pola contoh ke depan). Pola sama tiap bulan;
// grid HR menampilkannya otomatis, edit HR / approve tukar shift menimpanya (jadi row Shift
// per-tanggal, jadi cuma berlaku bulan itu — bulan depan kembali ke pola ini). match = awalan
// nama (lowercase), sinkron dengan nama di DB. Bulan <31 hari pakai token 1..dim saja.

type Row = { match: string; codes: string };

// 31 token per baris (dipisah spasi). Des 2026: tgl 1 = Selasa.
const ROWS: Row[] = [
  // Jogja
  { match: "delfia", codes: "O S P S P S WFH O S P S P S WFH O S P S P S WFH O S P S P S WFH O S P" },
  { match: "wimas", codes: "WFH P S P S P O WFH P S P S P O WFH P S P S P O WFH P S P S P O WFH P S" },
  { match: "yopi", codes: "S P O S P S P S P O S P S P S P O S P S P S P O S P S P S P O" },
  { match: "aldi", codes: "P O S P S P S P O S P S P S P O S P S P S P O S P S P S P O S" },
  { match: "indy", codes: "P S P O S P S P S P O S P S P S P O S P S P S P O S P S P S P" },
  { match: "edo", codes: "O S P S P S P O S P S P S P O S P S P S P O S P S P S P O S P" },
  { match: "junita", codes: "S P S P S P O S P S P S P O S P S P S P O S P S P S P O S P S" },
  { match: "dea", codes: "OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH" },
  { match: "andhin", codes: "P P P P WFH O P P P P P WFH O P P P P P WFH O P P P P P WFH O P P P P" },
  // Solo
  { match: "lala", codes: "O S P P S P S O S P P S P S O S P P S P S O S P P S P S O S P" },
  { match: "mutia", codes: "P S P O S P S P S P O S P S P S P O S P S P S P O S P S P S P" },
  { match: "ghifari", codes: "S P S P S P O S P S P S P O S P S P S P O S P S P S P O S P S" },
  { match: "mawa", codes: "P O S S P S P P O S S P S P P O S S P S P P O S S P S P P O S" },
  { match: "afi", codes: "S P O S P S P S P O S P S P S P O S P S P S P O S P S P S P O" },
  // Semarang
  { match: "jose", codes: "S S P P P S O S S P P P S O S S P P P S O S S P P P S O S S P" },
  { match: "nur taufiq", codes: "P O S S S P P P O S S S P P P O S S S P P P O S S S P P P O S" },
  { match: "rahma", codes: "S P O P S P S S P O P S P S S P O P S P S S P O P S P S S P O" },
  { match: "a taufiq", codes: "P P P O S S S P P P O S S S P P P O S S S P P P O S S S P P P" },
  { match: "irfan", codes: "O S S S P P P O S S S P P P O S S S P P P O S S S P P P O S S" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const table = ROWS.map((r) => ({ match: r.match, days: r.codes.trim().split(/\s+/) }));

const rowFor = (fullName: string) => {
  const n = norm(fullName);
  return table.find((r) => n.startsWith(r.match));
};

// Office yang ikut HARI (bukan tanggal): Sabtu WFH, Minggu Off, lainnya P. Benar di semua bulan.
const WEEKDAY_OFFICE = ["andhin", "dea"];

/** Kode shift default utk nama + tanggal (1..31). dow = hari (0=Minggu..6=Sabtu) jika ada.
 *  Andhin & Dea ikut hari, bukan pola tanggal. "" bila tak ada. */
export function defaultShift(fullName: string, day: number, dow?: number): string {
  if (dow != null && WEEKDAY_OFFICE.some((m) => norm(fullName).startsWith(m))) {
    return dow === 6 ? "WFH" : dow === 0 ? "O" : "P";
  }
  return rowFor(fullName)?.days[day - 1] ?? "";
}

/** True bila nama punya pola jadwal di PDF. */
export function hasShiftRow(fullName: string): boolean {
  return !!rowFor(fullName);
}
