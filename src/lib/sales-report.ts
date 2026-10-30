// Kategori report salah-input penjualan. Dipisah dari server action ("use server"
// hanya boleh export fungsi async) agar bisa diimpor komponen & page.
export const REPORT_CATEGORIES = ["TENAGA_PENJUAL", "STOK", "PEMBAYARAN"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export const REPORT_LABEL: Record<ReportCategory, string> = {
  TENAGA_PENJUAL: "Tenaga penjual",
  STOK: "Stok",
  PEMBAYARAN: "Pembayaran",
};
