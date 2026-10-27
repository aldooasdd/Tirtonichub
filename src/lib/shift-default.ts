// Jadwal default per karyawan per tanggal (1..31), dari PDF "Jadwal Tirtonic - OKT".
// Pola sama tiap bulan; grid HR menampilkannya otomatis, edit HR menimpanya (jadi row Shift).
// "" = kosong (mis. karyawan baru yang belum penuh sebulan). "PS"→P, "I"→IZIN, "ijin sakit"→SAKIT.

type Row = { match: string; codes: string };

// 31 token per baris (dipisah spasi). match = awalan nama (lowercase).
const ROWS: Row[] = [
  // Jogja
  { match: "kiki", codes: "P S P S P O S P S P S P WFH O P S P S WFH O S P S CUTI S P O S P CUTI CUTI" },
  { match: "wimas", codes: "S P S P O S P S P S P S WFH P S O S CUTI O WFH P S P S P S WFH O S P S" },
  { match: "yopi", codes: "O S P S P P O S S P S P S P O S P S P S P O S P S P P P O S P" },
  { match: "aldy", codes: "S P S P S S P O P S P S P O S P S P S S O S P S P S CUTI O S P S" },
  { match: "siti indira", codes: "P P S P S P S P P S O S P S P O S P S P S P P S O S P S P O S" },
  { match: "edo", codes: "S P S S S S P S P O P O S P S P S P O S P S P S P O S P S P S" },
  { match: "delfia", codes: "P S P CUTI P O S P S P S P O S P S P S P O S P S P S P O S P S P" },
  { match: "dea", codes: "OH OH OH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH" },
  { match: "karim", codes: "OH OH OH OH OH OH OH OH OH O WFH OH OH OH OH OH O WFH OH OH OH OH OH O WFH OH OH OH OH OH O" },
  { match: "andhin", codes: "OH OH OH OH OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH O OH OH OH OH OH WFH" },
  // Solo
  { match: "denta", codes: "O P CUTI CUTI P S P O S P" },
  { match: "lala", codes: "S S SAKIT P S P O S P S P S O S P P S P S P O S P S P S P O S P S" },
  { match: "mutia", codes: "P O S P S P S P O S P S P S P O S P S P S P O S P S P S P O S" },
  { match: "ghifari", codes: "S P P S O S P S P S P O S P S P S P O S P S P S P O S P S P IZIN" },
  { match: "erina", codes: "P S P S P O S P S SAKIT S P P O S S P S P O S P S P S P O S P S P" },
  { match: "afi", codes: "P O S P S P S P O P S P S P O S P S P S P O S P S P S P O S P" },
  // Semarang
  { match: "josephira", codes: "P P P S O S S P P P S O S S P P P S O S S P P P S O S S P P P" },
  { match: "nur", codes: "S S S P P P O S S S P P P O S S S P P P O S S S P P P O S S S" },
  { match: "rahma", codes: "O P S P S S P O P S P S S P O S S P S S P O P S P S S P O P S" },
  { match: "a taufiq", codes: "P O S S S P P P O S S S P P P O P S S P P P O S S S P P P O S" },
  { match: "irfan s", codes: "S S P P P O S S S P P P O S S P CUTI P P O S S S P P P O S S S P" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const table = ROWS.map((r) => ({ match: r.match, days: r.codes.trim().split(/\s+/) }));

// Nama di DB beda dgn nama di PDF → petakan ke baris PDF yang benar.
const ALIAS: Record<string, string> = {
  aldi: "aldy",
  indy: "siti indira",
  irfan: "irfan s",
  jose: "josephira",
  mawa: "erina",
};

const rowFor = (fullName: string) => {
  const n = ALIAS[norm(fullName)] ?? norm(fullName);
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
