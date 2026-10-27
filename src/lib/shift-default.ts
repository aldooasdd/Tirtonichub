// Jadwal default per karyawan per tanggal (1..30), dari PDF "Jadwal Tirtonic - NOV".
// Pola sama tiap bulan (berlaku sekarang & ke depan); grid HR menampilkannya otomatis,
// edit HR / approve tukar shift menimpanya (jadi row Shift). match = awalan nama (lowercase),
// sudah sinkron dengan nama di DB. Bulan 31 hari → tgl 31 kosong (HR isi manual).

type Row = { match: string; codes: string };

// 30 token per baris (dipisah spasi).
const ROWS: Row[] = [
  // Jogja
  { match: "delfia", codes: "S WFH O S P S P S WFH O S P S P S WFH O S P S P S WFH O S P S P S WFH" },
  { match: "wimas", codes: "P O WFH P S P S P O WFH P S P S P O WFH P S P S P O WFH P S P S P O" },
  { match: "yopi", codes: "S P S P O S P S P S P O S P S P S P O S P S P S P O S P S P" },
  { match: "aldi", codes: "P S P O S P S P S P O S P S P S P O S P S P S P O S P S P S" },
  { match: "indy", codes: "P S P S P O S P S P S P O S P S P S P O S P S P S P O S P S" },
  { match: "edo", codes: "P P O S P S P S P O S P S P S P O S P S P S P O S P S P S P" },
  { match: "junita", codes: "S O S P S P S P O S P S P S P O S P S P S P O S P S P S P O" },
  { match: "dea", codes: "O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH" },
  { match: "andhin", codes: "O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH" },
  // Solo
  { match: "lala", codes: "S O S P P S P S O S P P S P S O S P P S P S O S P P S P S O" },
  { match: "mutia", codes: "S P S P O S P S P S P O S P S P S P O S P S P S P O S P S P" },
  { match: "ghifari", codes: "O S P S P S P O S P S P S P O S P S P S P O S P S P S P O S" },
  { match: "mawa", codes: "P P O S S P S P P O S S P S P P O S S P S P P O S S P S P P" },
  { match: "afi", codes: "P S P O S P S P S P O S P S P S P O S P S P S P O S P S P S" },
  // Semarang
  { match: "jose", codes: "S O S S P P P S O S S P P P S O S S P P P S O S S P P P S O" },
  { match: "nur taufiq", codes: "P P P O S S S P P P O S S S P P P O S S S P P P O S S S P P" },
  { match: "rahma", codes: "P S S P O P S P S S P O P S P S S P O P S P S S P O P S P S" },
  { match: "a taufiq", codes: "S S P P P O S S S P P P O S S S P P P O S S S P P P O S S S" },
  { match: "irfan", codes: "P P O S S S P P P O S S S P P P O S S S P P P O S S S P P P" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const table = ROWS.map((r) => ({ match: r.match, days: r.codes.trim().split(/\s+/) }));

const rowFor = (fullName: string) => {
  const n = norm(fullName);
  return table.find((r) => n.startsWith(r.match));
};

/** Kode shift default utk nama + tanggal (1..31). "" bila tak ada. */
export function defaultShift(fullName: string, day: number): string {
  return rowFor(fullName)?.days[day - 1] ?? "";
}

/** True bila nama punya pola jadwal di PDF. */
export function hasShiftRow(fullName: string): boolean {
  return !!rowFor(fullName);
}
