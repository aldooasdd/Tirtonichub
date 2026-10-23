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

/** Untuk halaman: redirect ke login / pilih-role bila perlu. Return ctx dgn activeRole terisi. */
export async function requireAuth(): Promise<AuthContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.activeRole) redirect("/pilih-role");
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
  assert(can.manageEmployees(ctx.activeRole));
  return ctx;
}

/** Finance/Boss: scan nota + produk mentah. */
export async function requireFinance(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(can.manageFinance(ctx.activeRole));
  return ctx;
}

/** Stock Room/Boss: QC + stok. */
export async function requireStock(): Promise<AuthContext> {
  const ctx = await requireAuth();
  assert(can.manageStock(ctx.activeRole));
  return ctx;
}
