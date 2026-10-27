import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { PenjualanTable } from "@/components/sales/penjualan-table";

type Pay = { method: string; amount: number };
type Item = { name: string; qty: number; price: number; total: number; note: string | null };

export default async function FinancePenjualanPage() {
  await requireFinance();
  const reports = await prisma.salesReport.findMany({
    orderBy: { soldAt: "desc" },
    take: 500,
  });

  // satu baris per item (seperti spreadsheet). Cash = nota dibayar tunai.
  // ponytail: "cash" ditandai bila ada metode bayar mengandung tunai/cash; cukup utk rekap.
  const rows = reports.flatMap((r) => {
    const items = (Array.isArray(r.items) ? r.items : []) as Item[];
    const pays = (Array.isArray(r.payments) ? r.payments : []) as Pay[];
    const isCash = pays.some((p) => /tunai|cash/i.test(p.method || ""));
    const dateKey = new Date(r.soldAt.getTime() + 7 * 3600_000).toISOString().slice(0, 10); // WIB
    return items.map((it, i) => ({
      key: r.id + "-" + i,
      dateKey,
      pelanggan: r.customer || "-",
      nama: it.name || "-",
      qty: it.qty || 1,
      jual: it.total || it.price * (it.qty || 1),
      cash: isCash ? it.total || it.price * (it.qty || 1) : 0,
      saluran: r.channel === "online" ? "Online" : "Offline",
      ket: it.note || "",
      photoKey: r.photoKey,
      first: i === 0,
    }));
  });

  return <PenjualanTable rows={rows} />;
}
