import { requireStock } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { ReportList } from "@/components/sales/report-list";
import { REPORT_LABEL, type ReportCategory } from "@/server/actions/sales";

export default async function StokReportPenjualanPage() {
  await requireStock();
  const rows = await prisma.salesReport.findMany({
    where: { reportAt: { not: null }, reportResolvedAt: null, reportCategory: { in: ["TENAGA_PENJUAL", "STOK"] } },
    orderBy: { reportAt: "desc" },
    take: 200,
    include: { createdBy: { select: { fullName: true } } },
  });

  const list = rows.map((r) => ({
    id: r.id,
    soldAt: fmtWIB(r.soldAt),
    grandTotal: r.grandTotal,
    label: REPORT_LABEL[r.reportCategory as ReportCategory] ?? r.reportCategory ?? "-",
    note: r.reportNote || "-",
    branch: r.branchName || "-",
    salesman: r.salesman || "-",
    by: r.createdBy.fullName,
    photoKey: r.photoKey,
  }));

  return <ReportList rows={list} title="Report Penjualan (Stok)" desc="Salah-input tenaga penjual & stok. Perbaikan oleh Kepala Cabang." />;
}
