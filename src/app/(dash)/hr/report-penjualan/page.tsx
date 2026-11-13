import { requireHr } from "@/server/auth/rbac";
import { ReportList } from "@/components/sales/report-list";
import { loadSalesReports } from "@/server/sales-report-list";
import { REPORT_CATEGORIES } from "@/lib/sales-report";

/** HR: semua report salah-input (terbuka & selesai), hanya informasi. */
export default async function HrReportPenjualanPage() {
  await requireHr();
  const { rows, open } = await loadSalesReports([...REPORT_CATEGORIES], null);
  // ponytail: nota yang ditolak Kepala Cabang terhapus → report-nya ikut hilang. Simpan snapshot bila HR butuh.
  return <ReportList rows={rows} open={open} done={null} href="/hr/report-penjualan" title="Report Penjualan" desc={`Semua report salah-input penjualan (${open} masih terbuka). Merah = belum dibenarkan Kepala Cabang, hijau = selesai.`} />;
}
