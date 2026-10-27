import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtTgl(d: Date) {
  // WIB
  const w = new Date(d.getTime() + 7 * 3600_000);
  return `${HARI[w.getUTCDay()]} ${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

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
    return items.map((it, i) => ({
      key: r.id + "-" + i,
      tgl: fmtTgl(r.soldAt),
      pelanggan: r.customer || "-",
      nama: it.name || "-",
      qty: it.qty || 1,
      jual: it.total || it.price * (it.qty || 1),
      cash: isCash ? it.total || it.price * (it.qty || 1) : 0,
      saluran: "Offline", // sales nota = offline; online diinput admin (menyusul)
      ket: it.note || "",
      photoKey: r.photoKey,
      first: i === 0,
    }));
  });

  const total = rows.reduce((s, r) => s + r.jual, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Penjualan</h1>
          <p className="text-14 text-muted-foreground">Offline dari nota Sales. Online diinput Admin (marketplace).</p>
        </div>
        <p className="text-14 font-semibold shrink-0">{rupiah(total)} <span className="text-12 font-normal text-muted-foreground">· {rows.length} baris</span></p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card py-12 text-center text-muted-foreground">Belum ada penjualan.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14 border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-12 text-muted-foreground">
                <th className="px-3 py-2 font-medium whitespace-nowrap">Tanggal</th>
                <th className="px-3 py-2 font-medium">Pelanggan</th>
                <th className="px-3 py-2 font-medium">Nama Barang</th>
                <th className="px-3 py-2 font-medium text-right">Kuantitas</th>
                <th className="px-3 py-2 font-medium text-right">Penjualan</th>
                <th className="px-3 py-2 font-medium text-right">Cash</th>
                <th className="px-3 py-2 font-medium">Saluran</th>
                <th className="px-3 py-2 font-medium">Keterangan</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.tgl}</td>
                  <td className="px-3 py-2">{r.pelanggan}</td>
                  <td className="px-3 py-2">{r.nama}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{rupiah(r.jual)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.cash ? rupiah(r.cash) : ""}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-11">{r.saluran}</span>
                  </td>
                  <td className="px-3 py-2 text-12 text-muted-foreground">{r.ket}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.first && (
                      <a href={`/api/file?key=${encodeURIComponent(r.photoKey)}`} target="_blank" rel="noopener" className="text-12 text-primary">Nota</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
