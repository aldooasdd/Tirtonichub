// Kode shift jadwal kerja (dari PDF Jadwal Tirtonic). Jam bisa diubah HR nanti.
export type ShiftCode = "P" | "S" | "OH" | "O" | "WFH" | "CUTI" | "SAKIT" | "IZIN";

export type ShiftDef = {
  label: string;
  start?: string; // "HH:MM" WIB; ada → wajib absen
  end?: string;
  working: boolean; // true → dihitung telat/alpa bila tak absen
  cls: string; // warna sel grid
};

export const SHIFTS: Record<ShiftCode, ShiftDef> = {
  P: { label: "Pagi 08.30–15.30", start: "08:30", end: "15:30", working: true, cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  S: { label: "Siang 14.00–21.00", start: "14:00", end: "21:00", working: true, cls: "bg-sky-500/20 text-sky-700 dark:text-sky-300" },
  OH: { label: "Office 10.00–17.00", start: "10:00", end: "17:00", working: true, cls: "bg-violet-500/20 text-violet-700 dark:text-violet-300" },
  O: { label: "Libur", working: false, cls: "bg-muted text-muted-foreground" },
  WFH: { label: "WFH", working: false, cls: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  CUTI: { label: "Cuti", working: false, cls: "bg-rose-500/20 text-rose-700 dark:text-rose-300" },
  SAKIT: { label: "Sakit", working: false, cls: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  IZIN: { label: "Izin", working: false, cls: "bg-pink-500/20 text-pink-700 dark:text-pink-300" },
};

// Urutan klik sel: kosong → P → S → OH → O → WFH → CUTI → SAKIT → IZIN → kosong.
export const SHIFT_ORDER: ShiftCode[] = ["P", "S", "OH", "O", "WFH", "CUTI", "SAKIT", "IZIN"];

export const isShiftCode = (v: string): v is ShiftCode => (SHIFT_ORDER as string[]).includes(v);
