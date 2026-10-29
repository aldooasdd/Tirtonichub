import { requireFinance } from "@/server/auth/rbac";
import { isSuperRole } from "@/lib/roles";
import { prisma } from "@/server/db";
import { dateKeyWIB } from "@/server/attendance/logic";
import { loadBranchCashBoards } from "@/lib/cash";
import { BranchCashTreemap } from "@/components/cash/branch-cash-treemap";
import { FinanceClient } from "@/components/finance/finance-client";

export default async function FinancePage() {
  const ctx = await requireFinance();
  const [rows, boards] = await Promise.all([
    prisma.rawProduct.findMany({
      where: isSuperRole(ctx.activeRole) ? {} : { createdById: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { qcBy: { select: { fullName: true } } },
    }),
    loadBranchCashBoards(dateKeyWIB(new Date())),
  ]);

  return (
    <div className="space-y-5">
      <BranchCashTreemap
        branches={boards.map(({ branch, opened, report, close }) => ({
          id: branch.id,
          name: branch.name,
          opened,
          expected: report.expected,
          close,
        }))}
      />
      <FinanceClient
      isBoss={isSuperRole(ctx.activeRole)}
      items={rows.map((r) => ({
        id: r.id,
        batchId: r.batchId,
        name: r.name,
        brand: r.brand,
        color: r.color,
        size: r.size,
        sku: r.sku,
        qty: r.qty,
        unit: r.unit,
        unitPrice: r.unitPrice,
        sellPrice: r.sellPrice,
        supplier: r.supplier,
        notaDate: r.notaDate ? r.notaDate.toISOString().slice(0, 10) : null,
        status: r.status,
        qcNote: r.qcNote,
        qcByName: r.qcBy?.fullName ?? null,
      }))}
      />
    </div>
  );
}
