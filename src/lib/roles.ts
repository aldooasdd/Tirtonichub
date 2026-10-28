export const ROLE_CODES = [
  "BOSS",
  "MEDIA",
  "FINANCE",
  "STOCK_ROOM",
  "HR",
  "HEAD_BRANCH",
  "SALES",
  "ORDER_SPECIALIST",
  "ADMIN",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  BOSS: "Direksi",
  MEDIA: "Media",
  FINANCE: "Finance",
  STOCK_ROOM: "Stok Room",
  HR: "Human Resource",
  HEAD_BRANCH: "Head Branch",
  SALES: "Sales",
  ORDER_SPECIALIST: "Order Specialist",
  ADMIN: "Admin",
};

/** Role yang punya modul HR (kelola karyawan, rekap, approval, dll). */
export const HR_ROLES: RoleCode[] = ["BOSS", "HR"];
/** Finance: scan nota + produk mentah. */
export const FINANCE_ROLES: RoleCode[] = ["BOSS", "FINANCE"];
/** Stock Room: QC + stok. */
export const STOCK_ROLES: RoleCode[] = ["BOSS", "STOCK_ROOM"];
/** Media: Tirtonic Studio (produksi konten). */
export const MEDIA_ROLES: RoleCode[] = ["BOSS", "MEDIA"];
/** Sales: kirim rekap penjualan (foto nota). */
export const SALES_ROLES: RoleCode[] = ["BOSS", "SALES"];
/** Admin: (lama input penjualan online — kini approval pindah ke Order Specialist). */
export const ADMIN_ROLES: RoleCode[] = ["BOSS", "ADMIN"];
/** Order Specialist: approve penjualan online dari Sales sebelum masuk Finance. */
export const ORDER_SPECIALIST_ROLES: RoleCode[] = ["BOSS", "ORDER_SPECIALIST"];
/** Kepala Cabang: ACC penjualan offline cabang sebelum masuk Finance. */
export const HEAD_BRANCH_ROLES: RoleCode[] = ["BOSS", "HEAD_BRANCH"];

/** Boss tidak absen; role lain absen. (PRD §3) */
export function roleAttends(role: RoleCode): boolean {
  return role !== "BOSS";
}
