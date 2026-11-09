import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { PembelianTable, type PembelianRow } from "@/components/cash/pembelian-table";

export default async function FinancePembelianPage() {
  await requireFinance();
  // Hanya yang sudah di-ACC Kepala Cabang.
  const rows = await prisma.cashout.findMany({
    where: { approvedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { createdBy: { select: { fullName: true } } },
  });
  const checkerIds = [...new Set(rows.map((r) => r.checkedById).filter(Boolean) as string[])];
  const checkers = checkerIds.length
    ? await prisma.user.findMany({ where: { id: { in: checkerIds } }, select: { id: true, fullName: true } })
    : [];
  const checkerName = new Map(checkers.map((u) => [u.id, u.fullName]));
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const data: PembelianRow[] = rows.map((r) => ({
    id: r.id,
    tgl: fmtWIB(r.spentAt),
    spentAtLocal: new Date(r.spentAt.getTime() + 7 * 3600_000).toISOString().slice(0, 16), // datetime-local WIB
    category: r.category ?? "-",
    branch: r.branchName ?? "-",
    branchId: r.branchId,
    source: r.source,
    description: r.description,
    by: r.createdBy.fullName,
    amount: r.amount,
    photoKey: r.photoKey,
    checked: r.checkedAt != null,
    checkedBy: r.checkedById ? checkerName.get(r.checkedById) ?? null : null,
  }));

  return <PembelianTable rows={data} branches={branches} />;
}
