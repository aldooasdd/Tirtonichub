import { requireHr } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ApprovalClient } from "@/components/hr/approval-client";

type Payload = { counterpartId?: string; counterpartApproved?: boolean };

export default async function ApprovalPage() {
  await requireHr();
  const rows = await prisma.request.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { fullName: true } } },
  });

  // Nama pengganti utk semua pengajuan yang punya pengganti.
  const cpIds = rows
    .map((r) => (r.payload as Payload)?.counterpartId)
    .filter((v): v is string => !!v);
  const cps = cpIds.length
    ? await prisma.user.findMany({ where: { id: { in: cpIds } }, select: { id: true, fullName: true } })
    : [];
  const cpName = new Map(cps.map((u) => [u.id, u.fullName]));

  return (
    <ApprovalClient
      requests={rows.map((r) => {
        const p = (r.payload ?? {}) as Payload;
        return {
          id: r.id,
          userName: r.user.fullName,
          type: r.type,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          reason: r.reason,
          swap: p.counterpartId
            ? { counterpart: cpName.get(p.counterpartId) ?? "-", approved: !!p.counterpartApproved }
            : null,
        };
      })}
    />
  );
}
