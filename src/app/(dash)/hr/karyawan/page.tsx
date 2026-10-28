import { requireHr } from "@/server/auth/rbac";
import { isSuperRole } from "@/lib/roles";
import { prisma } from "@/server/db";
import { KaryawanClient } from "@/components/hr/karyawan-client";

export default async function KaryawanPage() {
  const ctx = await requireHr();
  const [users, branches, schedules] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { roles: { include: { role: true } }, branch: true },
    }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.workSchedule.findMany({ orderBy: { name: "asc" } }),
  ]);

  const data = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    waNumber: u.waNumber,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    joinedAt: u.joinedAt ? u.joinedAt.toISOString().slice(0, 10) : null,
    isActive: u.isActive,
    roleCodes: u.roles.map((r) => r.role.code),
  }));

  return (
    <KaryawanClient
      users={data}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      schedules={schedules.map((s) => ({ id: s.id, name: s.name }))}
      canAssignBossHr={isSuperRole(ctx.activeRole)}
      selfId={ctx.userId}
    />
  );
}
