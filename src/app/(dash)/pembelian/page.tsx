import { requireCashoutInput } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { CashoutForm } from "@/components/cashout/cashout-form";

export default async function PembelianPage() {
  const ctx = await requireCashoutInput();
  const rows = await prisma.cashout.findMany({
    where: { createdById: ctx.userId },
    orderBy: { spentAt: "desc" },
    take: 50,
  });
  return (
    <CashoutForm
      rows={rows.map((r) => ({
        id: r.id,
        spentAt: fmtWIB(r.spentAt),
        amount: r.amount,
        description: r.description,
        branch: r.branchName ?? "-",
        approved: r.approvedAt != null,
      }))}
    />
  );
}
