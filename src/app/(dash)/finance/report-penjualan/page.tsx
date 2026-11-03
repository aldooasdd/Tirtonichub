import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { userNames } from "@/server/user-names";
import { fmtWIB } from "@/lib/datetime";
import { ReportList } from "@/components/sales/report-list";
import { REPORT_LABEL, type ReportCategory } from "@/lib/sales-report";

export default async function FinanceReportPenjualanPage() {
  await requireFinance();
  const rows = await prisma.salesReport.findMany({
    where: { reportAt: { not: null }, reportResolvedAt: null, reportCategory: "PEMBAYARAN" },
    orderBy: { reportAt: "desc" },
    take: 200,
    include: { createdBy: { select: { fullName: true } } },
  });

  const nameOf = await userNames(rows.map((r) => r.reportById));
  const list = rows.map((r) => ({
    id: r.id,
    soldAt: fmtWIB(r.soldAt),
    grandTotal: r.grandTotal,
    label: REPORT_LABEL[r.reportCategory as ReportCategory] ?? r.reportCategory ?? "-",
    note: r.reportNote || "-",
    branch: r.branchName || "-",
    salesman: r.salesman || "-",
    by: r.createdBy.fullName,
    reporter: nameOf(r.reportById),
    photoKey: r.photoKey,
  }));

  return <ReportList rows={list} title="Report Penjualan (Pembayaran)" desc="Salah-input metode pembayaran. Perbaikan oleh Kepala Cabang." />;
}
