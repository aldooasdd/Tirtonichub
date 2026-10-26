import { requireSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { SalesClient } from "@/components/sales/sales-client";

export default async function SalesPage() {
  const ctx = await requireSales();
  const canViewAll = ctx.activeRole === "BOSS";
  const rows = await prisma.salesReport.findMany({
    where: canViewAll ? {} : { createdById: ctx.userId },
    orderBy: { soldAt: "desc" },
    take: 50,
    include: { createdBy: { select: { fullName: true } } },
  });

  return (
    <SalesClient
      canViewAll={canViewAll}
      reports={rows.map((r) => ({
        id: r.id,
        soldAt: fmtWIB(r.soldAt),
        salesman: r.salesman,
        customer: r.customer,
        grandTotal: r.grandTotal,
        itemCount: Array.isArray(r.items) ? (r.items as unknown[]).length : 0,
        by: r.createdBy.fullName,
      }))}
    />
  );
}
