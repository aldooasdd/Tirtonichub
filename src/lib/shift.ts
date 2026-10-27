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
  P: { label: "Pagi 08.30–15.30", start: "08:30", end: "15:30", working: true, cls: "bg-emerald-600 text-white" },
  S: { label: "Siang 14.00–21.00", start: "14:00", end: "21:00", working: true, cls: "bg-sky-600 text-white" },
  OH: { label: "Office 10.00–17.00", start: "10:00", end: "17:00", working: true, cls: "bg-violet-600 text-white" },
  O: { label: "Libur", working: false, cls: "bg-red-600 text-white" },
  WFH: { label: "WFH", working: false, cls: "bg-amber-600 text-white" },
  CUTI: { label: "Cuti", working: false, cls: "bg-rose-600 text-white" },
  SAKIT: { label: "Sakit", working: false, cls: "bg-orange-600 text-white" },
  IZIN: { label: "Izin", working: false, cls: "bg-pink-600 text-white" },
};

// Urutan klik sel: kosong → P → S → OH → O → WFH → CUTI → SAKIT → IZIN → kosong.
export const SHIFT_ORDER: ShiftCode[] = ["P", "S", "OH", "O", "WFH", "CUTI", "SAKIT", "IZIN"];

export const isShiftCode = (v: string): v is ShiftCode => (SHIFT_ORDER as string[]).includes(v);
