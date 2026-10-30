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

  const data: PembelianRow[] = rows.map((r) => ({
    id: r.id,
    tgl: fmtWIB(r.spentAt),
    category: r.category ?? "-",
    branch: r.branchName ?? "-",
    description: r.description,
    by: r.createdBy.fullName,
    amount: r.amount,
    photoKey: r.photoKey,
    checked: r.checkedAt != null,
    checkedBy: r.checkedById ? checkerName.get(r.checkedById) ?? null : null,
  }));

  return <PembelianTable rows={data} />;
}
