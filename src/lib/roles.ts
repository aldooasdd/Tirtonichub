export const ROLE_CODES = [
  "BOSS",
  "MEDIA",
  "FINANCE",
  "STOCK_ROOM",
  "HR",
  "HEAD_BRANCH",
  "SALES",
  "ORDER_SPECIALIST",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  BOSS: "Boss",
  MEDIA: "Media",
  FINANCE: "Finance",
  STOCK_ROOM: "Stok Room",
  HR: "Human Resource",
  HEAD_BRANCH: "Head Branch",
  SALES: "Sales",
  ORDER_SPECIALIST: "Order Specialist",
};

/** Role yang punya modul HR (kelola karyawan, rekap, approval, dll). */
export const HR_ROLES: RoleCode[] = ["BOSS", "HR"];
/** Finance: scan nota + produk mentah. */
export const FINANCE_ROLES: RoleCode[] = ["BOSS", "FINANCE"];
/** Stock Room: QC + stok. */
export const STOCK_ROLES: RoleCode[] = ["BOSS", "STOCK_ROOM"];
/** Media: Tirtonic Studio (produksi konten). */
export const MEDIA_ROLES: RoleCode[] = ["BOSS", "MEDIA"];

/** Boss tidak absen; role lain absen. (PRD §3) */
export function roleAttends(role: RoleCode): boolean {
  return role !== "BOSS";
}
