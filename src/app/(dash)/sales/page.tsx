import { requireSales } from "@/server/auth/rbac";
import { isSuperRole } from "@/lib/roles";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { SalesClient, type SalesRow } from "@/components/sales/sales-client";

export default async function SalesPage() {
  const ctx = await requireSales();
  const canViewAll = isSuperRole(ctx.activeRole);
  // Kepala Cabang: lihat semua nota cabangnya. Sales: hanya miliknya.
  const mine = canViewAll
    ? {}
    : ctx.activeRole === "HEAD_BRANCH"
      ? { branchId: ctx.branchId }
      : { createdById: ctx.userId };
  const rows = await prisma.salesReport.findMany({
    where: { ...mine },
    orderBy: { createdAt: "desc" },
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
