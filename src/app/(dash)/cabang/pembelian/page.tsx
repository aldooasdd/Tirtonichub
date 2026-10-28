import { requireHeadBranch } from "@/server/auth/rbac";
import { isSuperRole } from "@/lib/roles";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CashoutApproval } from "@/components/cashout/cashout-approval";

export default async function CabangPembelianPage() {
  const ctx = await requireHeadBranch();
  const isBoss = isSuperRole(ctx.activeRole);
  const rows = await prisma.cashout.findMany({
    where: { approvedAt: null, ...(isBoss ? {} : { branchId: ctx.branchId }) },
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
        branch: r.branchName ?? "-",
        by: r.createdBy.fullName,
        photoKey: r.photoKey,
      }))}
    />
  );
}
