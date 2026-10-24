import { prisma } from "@/server/db";
import type { AuthContext } from "@/server/auth/rbac";

export type MediaAccess = {
  full: boolean; // admin penuh (BOSS atau MediaMember.role=ADMIN): kode Louis1, tim, laporan
  admin2: boolean; // kelola barang/konten/pengaturan tanpa tim & laporan
  canManage: boolean; // full || admin2
  idcc: boolean; // boleh Analisis IDCC
  code: string | null; // Z/R/A/S
  role: "admin" | "admin2" | "member" | null;
};

/** Tingkat akses media untuk user aktif. BOSS = admin penuh walau tanpa MediaMember. */
export async function mediaAccess(ctx: AuthContext): Promise<MediaAccess> {
  const m = await prisma.mediaMember.findUnique({ where: { userId: ctx.userId } });
  const isBoss = ctx.activeRole === "BOSS";
  const full = isBoss || m?.role === "ADMIN";
  const admin2 = m?.role === "ADMIN2";
  return {
    full,
    admin2,
    canManage: full || admin2,
    idcc: full || admin2 || !!m?.idcc,
    code: m?.code ?? null,
    role: m ? (m.role.toLowerCase() as "admin" | "admin2" | "member") : null,
  };
}
