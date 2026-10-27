import { requireSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { SalesClient, type SalesRow } from "@/components/sales/sales-client";

export default async function SalesPage() {
  const ctx = await requireSales();
  const canViewAll = ctx.activeRole === "BOSS";
  const mine = canViewAll ? {} : { createdById: ctx.userId };
  const rows = await prisma.salesReport.findMany({
    where: { ...mine },
    orderBy: { soldAt: "desc" },
    take: 100,
    include: { createdBy: { select: { fullName: true } } },
  });

  const map = (channel: "online" | "offline"): SalesRow[] =>
    rows
      .filter((r) => r.channel === channel)
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        soldAt: fmtWIB(r.soldAt),
        salesman: r.salesman,
        customer: r.customer,
        grandTotal: r.grandTotal,
        itemCount: Array.isArray(r.items) ? (r.items as unknown[]).length : 0,
        by: r.createdBy.fullName,
        pending: r.approvedAt == null,
      }));

  return <SalesClient canViewAll={canViewAll} reports={map("offline")} reportsOnline={map("online")} />;
}
