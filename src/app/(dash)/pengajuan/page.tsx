import { requireAuth } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { roleAttends } from "@/lib/roles";
import { PengajuanClient } from "@/components/pengajuan/pengajuan-client";

type Payload = { counterpartId?: string; counterpartApproved?: boolean };

export default async function PengajuanPage() {
  const ctx = await requireAuth();
  if (!roleAttends(ctx.activeRole)) {
    return (
      <div className="rounded-lg bg-card p-6 text-center text-muted-foreground">
        Role Boss tidak mengajukan cuti/izin.
      </div>
    );
  }

  const [rows, employees, incomingRaw] = await Promise.all([
    prisma.request.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { isActive: true, id: { not: ctx.userId }, roles: { some: { role: { code: { not: "BOSS" } } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.request.findMany({
      where: { type: "SHIFT_SWAP", status: "PENDING", payload: { path: ["counterpartId"], equals: ctx.userId } },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const empName = new Map(employees.map((e) => [e.id, e.fullName]));
  const incoming = incomingRaw
    .filter((r) => !(r.payload as Payload)?.counterpartApproved)
    .map((r) => ({ id: r.id, requester: r.user.fullName, date: r.startDate.toISOString().slice(0, 10), reason: r.reason }));

  return (
    <PengajuanClient
      employees={employees}
      incoming={incoming}
      requests={rows.map((r) => {
        const p = (r.payload ?? {}) as Payload;
        return {
          id: r.id,
          type: r.type,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          reason: r.reason,
          status: r.status,
          reviewNote: r.reviewNote,
          swap:
            r.type === "SHIFT_SWAP"
              ? { counterpart: empName.get(p.counterpartId ?? "") ?? "-", approved: !!p.counterpartApproved }
              : null,
        };
      })}
    />
  );
}
