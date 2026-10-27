import type { RoleCode } from "@/generated/prisma";

const HR_ROLES: RoleCode[] = ["BOSS", "HR"];
const FINANCE_ROLES: RoleCode[] = ["BOSS", "FINANCE"];
const STOCK_ROLES: RoleCode[] = ["BOSS", "STOCK_ROOM"]; // Stock Room juga pegang QC
const MEDIA_ROLES: RoleCode[] = ["BOSS", "MEDIA"]; // Tirtonic Studio (produksi konten)
const SALES_ROLES: RoleCode[] = ["BOSS", "SALES"]; // kirim rekap penjualan (foto nota)
const ADMIN_ROLES: RoleCode[] = ["BOSS", "ADMIN"]; // input penjualan online (screenshot marketplace)
const SALES_INPUT_ROLES: RoleCode[] = ["BOSS", "SALES", "ADMIN"]; // boleh input penjualan (offline/online)
const HEAD_BRANCH_ROLES: RoleCode[] = ["BOSS", "HEAD_BRANCH"]; // ACC penjualan offline cabang sebelum masuk Finance

/** Izin murni (tanpa DB/next) — bisa diuji langsung. */
export const can = {
  manageEmployees: (role: RoleCode) => HR_ROLES.includes(role),
  manageBranchSchedule: (role: RoleCode) => HR_ROLES.includes(role),
  approveRequest: (role: RoleCode) => HR_ROLES.includes(role),
  viewAllAttendance: (role: RoleCode) => HR_ROLES.includes(role), // Head Branch TIDAK (§11.1)
  viewSessions: (role: RoleCode) => HR_ROLES.includes(role),
  viewActivityLog: (role: RoleCode) => HR_ROLES.includes(role),

  // Finance: scan nota + kelola produk mentah. Stock Room: QC + stok.
  manageFinance: (role: RoleCode) => FINANCE_ROLES.includes(role),
  manageStock: (role: RoleCode) => STOCK_ROLES.includes(role),
  manageMedia: (role: RoleCode) => MEDIA_ROLES.includes(role),
  manageSales: (role: RoleCode) => SALES_ROLES.includes(role),
  manageOnlineSales: (role: RoleCode) => ADMIN_ROLES.includes(role),
  inputSales: (role: RoleCode) => SALES_INPUT_ROLES.includes(role),
  approveBranchSales: (role: RoleCode) => HEAD_BRANCH_ROLES.includes(role),

  /** Atur role tertentu di akun targetUserId. Anti-eskalasi (PRD §3). */
  assignRole(
    ctx: { activeRole: RoleCode; userId: string },
    target: RoleCode,
    targetUserId: string,
  ): boolean {
    if (ctx.activeRole === "BOSS") return true; // Boss: semua role
    if (ctx.activeRole !== "HR") return false;
    if (target === "BOSS" || target === "HR") return false; // HR tak boleh Boss/HR
    if (targetUserId === ctx.userId) return false; // HR tak boleh ubah akun sendiri
    return true;
  },
};
