import { requireFinance } from "@/server/auth/rbac";
import { ReportList } from "@/components/sales/report-list";
import { loadSalesReports } from "@/server/sales-report-list";

export default async function FinanceReportPenjualanPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireFinance();
  const done = (await searchParams).s === "selesai";
  const { rows, open } = await loadSalesReports(["PEMBAYARAN"], done);
  return <ReportList rows={rows} open={open} done={done} href="/finance/report-penjualan" title="Report Penjualan (Pembayaran)" desc="Salah-input metode pembayaran. Perbaikan oleh Kepala Cabang (menu Cabang → Approval Penjualan)." />;
}
