import { requireStock } from "@/server/auth/rbac";
import { ReportList } from "@/components/sales/report-list";
import { loadSalesReports } from "@/server/sales-report-list";

export default async function StokReportPenjualanPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireStock();
  const done = (await searchParams).s === "selesai";
  const { rows, open } = await loadSalesReports(["TENAGA_PENJUAL", "STOK"], done);
  return <ReportList rows={rows} open={open} done={done} href="/stok/report-penjualan" title="Report Penjualan (Stok)" desc="Salah-input tenaga penjual & stok. Perbaikan oleh Kepala Cabang (menu Cabang → Approval Penjualan)." />;
}
