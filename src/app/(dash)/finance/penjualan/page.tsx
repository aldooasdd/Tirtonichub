import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { PenjualanTable } from "@/components/sales/penjualan-table";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtTgl(key: string) {
  const d = new Date(key + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type Pay = { method: string; amount: number };
type Item = { name: string; qty: number; price: number; total: number; note: string | null };

export default async function FinancePenjualanPage() {
  await requireFinance();
  const reports = await prisma.salesReport.findMany({
    orderBy: { soldAt: "desc" },
    take: 500,
  });

  // satu kartu per nota + total per nota. Cash = nota dibayar tunai.
  // ponytail: "cash" ditandai bila ada metode bayar mengandung tunai/cash.
  const notas = reports.map((r) => {
    const items = (Array.isArray(r.items) ? r.items : []) as Item[];
    const pays = (Array.isArray(r.payments) ? r.payments : []) as Pay[];
    const isCash = pays.some((p) => /tunai|cash/i.test(p.method || ""));
    const wib = new Date(r.soldAt.getTime() + 7 * 3600_000);
    const dateKey = wib.toISOString().slice(0, 10); // WIB
    return {
      id: r.id,
      dateKey,
      tgl: fmtTgl(dateKey),
      customer: r.customer || "-",
      branch: r.branchName || (r.channel === "online" ? "Online" : "-"),
      saluran: r.channel === "online" ? "Online" : "Offline",
      grandTotal: r.grandTotal,
      photoKey: r.photoKey,
      items: items.map((it) => {
        const jual = it.total ?? it.price * (it.qty || 1); // total net eksplisit (0 utk diskon 100%) dihormati
        return { name: it.name || "-", qty: it.qty || 1, jual, cash: isCash ? jual : 0 };
      }),
      // data mentah utk edit
      edit: {
        notaNo: r.notaNo ?? "",
        soldAt: wib.toISOString().slice(0, 16), // datetime-local (WIB)
        customer: r.customer ?? "",
        salesman: r.salesman ?? "",
        employee: r.employee ?? "",
        subtotal: r.subtotal,
        total: r.total,
        grandTotal: r.grandTotal,
        items: items.map((it) => ({ name: it.name ?? "", qty: it.qty || 1, price: it.price || 0, total: it.total ?? 0, note: it.note ?? null })),
        payments: pays.map((p) => ({ method: p.method || "", amount: p.amount || 0 })),
      },
    };
  });

  return <PenjualanTable notas={notas} />;
}
