import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CashoutApproval } from "@/components/cashout/cashout-approval";

export default async function CabangPembelianPage() {
  await requireFinance();
  const rows = await prisma.cashout.findMany({
    where: { approvedAt: null },
    orderBy: { spentAt: "desc" },
    take: 200,
    include: { createdBy: { select: { fullName: true } } },
  });
  return (
    <CashoutApproval
      pending={rows.map((r) => ({
        id: r.id,
        spentAt: fmtWIB(r.spentAt),
        amount: r.amount,
        description: r.description,
        category: r.category,
        branch: r.branchName ?? "-",
        by: r.createdBy.fullName,
        photoKey: r.photoKey,
      }))}
    />
  );
}
