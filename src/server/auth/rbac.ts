import { redirect } from "next/navigation";
import type { RoleCode } from "@/generated/prisma";
import { getSession } from "./session";
import { can } from "./permissions";

export { can };

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {
  constructor(msg = "Tidak diizinkan") {
    super(msg);
  }
}

export type AuthContext = {
  userId: string;
  sessionId: string;
  activeRole: RoleCode;
  allRoles: RoleCode[];
  branchId: string | null;
};

export function assert(condition: boolean): asserts condition {
  if (!condition) throw new ForbiddenError();
}

/** Untuk halaman: redirect ke login bila perlu. activeRole default otomatis (tanpa pilih). */
export async function requireAuth(): Promise<AuthContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.activeRole) redirect("/login"); // tak punya role → tak bisa pakai dashboard
  return {
    userId: s.user.id,
    sessionId: s.sessionId,
    activeRole: s.activeRole,
    allRoles: s.roles,
    branchId: s.user.branchId,
  };
}

/** Untuk halaman khusus HR/Boss. */
export async function requireHr(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageEmployees));
  return ctx;
}

/** Finance/Boss: scan nota + produk mentah. */
export async function requireFinance(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageFinance));
  return ctx;
}

/** Stock Room/Boss: QC + stok. */
export async function requireStock(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageStock));
  return ctx;
}

/** Media/Boss: Tirtonic Studio (produksi konten). */
export async function requireMedia(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageMedia));
  return ctx;
}

/** Sales/Boss: kirim rekap penjualan (foto nota). */
export async function requireSales(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageSales));
  return ctx;
}

/** Order Specialist/Boss: approve penjualan online dari Sales. */
export async function requireOnlineSales(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageOnlineSales));
  return ctx;
}

/** Sales/Admin/Boss: boleh input penjualan (dipakai action scan/simpan). */
export async function requireSalesInput(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.inputSales));
  return ctx;
}

/** Sales/Finance/Admin/Boss: boleh input pembelian/pengeluaran. */
export async function requireCashoutInput(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.inputCashout));
  return ctx;
}

/** Kepala Cabang/Boss: ACC penjualan offline cabang sebelum masuk Finance. */
export async function requireHeadBranch(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.approveBranchSales));
  return ctx;
}

/** Untuk halaman laporan masuk (Admin/Boss). */
export async function requireReports(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(ctx.allRoles.some(can.manageReports));
  return ctx;
}
