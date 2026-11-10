// Daftar report salah-input penjualan untuk halaman Report Penjualan (Stok / Finance).
import { prisma } from "@/server/db";
import { userNames } from "@/server/user-names";
import { fmtWIB } from "@/lib/datetime";
import { REPORT_LABEL, type ReportCategory } from "@/lib/sales-report";
import type { ReportRow } from "@/components/sales/report-list";

/** done=false → report terbuka; done=true → riwayat yang sudah selesai (200 terbaru). */
export async function loadSalesReports(categories: ReportCategory[], done: boolean): Promise<{ rows: ReportRow[]; open: number }> {
  const base = { reportAt: { not: null }, reportCategory: { in: categories } };
  const [rows, open] = await Promise.all([
    prisma.salesReport.findMany({
      where: { ...base, reportResolvedAt: done ? { not: null } : null },
      orderBy: done ? { reportResolvedAt: "desc" } : { reportAt: "desc" },
      take: 200,
      include: { createdBy: { select: { fullName: true } } },
    }),
    prisma.salesReport.count({ where: { ...base, reportResolvedAt: null } }),
  ]);
  const nameOf = await userNames(rows.map((r) => r.reportById));
  return {
    open,
    rows: rows.map((r) => ({
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
      reportedAt: r.reportAt ? fmtWIB(r.reportAt) : "-",
      resolvedAt: r.reportResolvedAt ? fmtWIB(r.reportResolvedAt) : null,
    })),
  };
}
