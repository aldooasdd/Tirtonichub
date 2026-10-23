import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { FinanceClient } from "@/components/finance/finance-client";

export default async function FinancePage() {
  const ctx = await requireFinance();
  const rows = await prisma.rawProduct.findMany({
    where: ctx.activeRole === "BOSS" ? {} : { createdById: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { qcBy: { select: { fullName: true } } },
  });

  return (
    <FinanceClient
      items={rows.map((r) => ({
        id: r.id,
        batchId: r.batchId,
        name: r.name,
        qty: r.qty,
        unit: r.unit,
        unitPrice: r.unitPrice,
        supplier: r.supplier,
        notaDate: r.notaDate ? r.notaDate.toISOString().slice(0, 10) : null,
        status: r.status,
        qcNote: r.qcNote,
        qcByName: r.qcBy?.fullName ?? null,
      }))}
    />
  );
}
