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

// Admin = super user (akses penuh seperti BOSS) → ikut di semua modul.
/** Role yang punya modul HR (kelola karyawan, rekap, approval, dll). */
export const HR_ROLES: RoleCode[] = ["BOSS", "ADMIN", "HR"];
/** Finance: scan nota + produk mentah. */
export const FINANCE_ROLES: RoleCode[] = ["BOSS", "ADMIN", "FINANCE"];
/** Stock Room: QC + stok. */
export const STOCK_ROLES: RoleCode[] = ["BOSS", "ADMIN", "STOCK_ROOM"];
/** Media: Tirtonic Studio (produksi konten). */
export const MEDIA_ROLES: RoleCode[] = ["BOSS", "ADMIN", "MEDIA"];
/** Sales: kirim rekap penjualan (foto nota). */
export const SALES_ROLES: RoleCode[] = ["BOSS", "ADMIN", "SALES"];
/** Admin: super user akses penuh. */
export const ADMIN_ROLES: RoleCode[] = ["BOSS", "ADMIN"];
/** Order Specialist: approve penjualan online dari Sales sebelum masuk Finance. */
export const ORDER_SPECIALIST_ROLES: RoleCode[] = ["BOSS", "ADMIN", "ORDER_SPECIALIST"];
/** Kepala Cabang: ACC penjualan offline cabang sebelum masuk Finance. */
export const HEAD_BRANCH_ROLES: RoleCode[] = ["BOSS", "ADMIN", "HEAD_BRANCH"];

/** Boss tidak absen; role lain absen. (PRD §3) */
export function roleAttends(role: RoleCode): boolean {
  return role !== "BOSS";
}

/** Super user akses penuh: BOSS & ADMIN (dipakai cek scope "lihat/ubah semua", bukan hanya cabang sendiri). */
export function isSuperRole(role: string): boolean {
  return role === "BOSS" || role === "ADMIN";
}

/** Role aktif default (tanpa pilih manual): BOSS → ADMIN → role pertama. null bila tak punya role. */
export function pickDefaultRole(roles: RoleCode[]): RoleCode | null {
  if (roles.length === 0) return null;
  return roles.find((r) => r === "BOSS") ?? roles.find((r) => r === "ADMIN") ?? roles[0];
}
