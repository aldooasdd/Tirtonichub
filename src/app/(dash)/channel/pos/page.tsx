import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { PosPassword } from "@/components/pos/pos-password";
import { CabangClient } from "@/components/pos/cabang-client";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Awal hari WIB, (days-1) hari lalu. */
const startOf = (days: number) => new Date(`${wibDate(new Date(Date.now() - (days - 1) * 86400_000))}T00:00:00+07:00`);

const PERIODS = [
  { key: "hari", label: "Hari ini", days: 1 },
  { key: "7", label: "7 hari", days: 7 },
  { key: "30", label: "30 hari", days: 30 },
] as const;

type Sale = { method: string; amount: number };
type Item = { name: string; qty: number; total: number };

const Card = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div className="rounded-lg border bg-card p-4">
    <p className="text-12 text-muted-foreground">{k}</p>
    <p className="text-18 font-semibold tabular-nums">{v}</p>
    {sub && <p className="text-12 text-muted-foreground">{sub}</p>}
  </div>
);

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-16 font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {head.map((h, i) => <th key={h} className={`p-3 font-normal ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr:last-child]:border-b-0">
            {rows.length ? rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={`p-3 ${j > 0 ? "text-right tabular-nums whitespace-nowrap" : ""}`}>{c}</td>)}</tr>
            )) : (
              <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Ringkasan penjualan kasir /pos (Tirtonic POS) semua cabang. Nota POS = photoKey "". */
export default async function PosDashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireChannel();
  const { p } = await searchParams;
  const period = PERIODS.find((x) => x.key === p) ?? PERIODS[0];
  const from = startOf(period.days);

  const [sales, branches] = await Promise.all([
    prisma.salesReport.findMany({ where: { photoKey: "", soldAt: { gte: from } }, orderBy: { soldAt: "desc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
  ]);

  const omzet = sales.reduce((n, s) => n + s.grandTotal, 0);
  const items = sales.flatMap((s) => s.items as Item[]);
  const pending = sales.filter((s) => !s.branchApprovedAt).length;
  const final = sales.filter((s) => s.approvedAt).length;

  const group = <T,>(keyOf: (s: (typeof sales)[number]) => T) => {
    const m = new Map<T, { n: number; sum: number }>();
    for (const s of sales) {
      const g = m.get(keyOf(s)) ?? { n: 0, sum: 0 };
      g.n++;
      g.sum += s.grandTotal;
      m.set(keyOf(s), g);
    }
    return m;
  };
  const byBranch = group((s) => s.branchId);
  const bySales = [...group((s) => s.salesman ?? "—")].sort((a, b) => b[1].sum - a[1].sum);
  const byMethod = new Map<string, number>();
  for (const s of sales) for (const pay of s.payments as Sale[]) byMethod.set(pay.method, (byMethod.get(pay.method) ?? 0) + Math.min(pay.amount, s.grandTotal));
  const byProduct = new Map<string, { qty: number; sum: number }>();
  for (const it of items) {
    const g = byProduct.get(it.name) ?? { qty: 0, sum: 0 };
    g.qty += it.qty;
    g.sum += it.total;
    byProduct.set(it.name, g);
  }
  const top = [...byProduct].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
  const status = (s: (typeof sales)[number]) => (s.approvedAt ? "Final" : s.branchApprovedAt ? "Di Finance" : "Menunggu ACC cabang");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Tirtonic POS</h1>
          <p className="text-14 text-muted-foreground">Penjualan & pengaturan mesin kasir <code>/pos</code> semua cabang. Password kasir diatur di tabel Per cabang (wajib beda tiap cabang).</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((x) => (
            <Link key={x.key} href={`/channel/pos?p=${x.key}`} className={`rounded-full border px-3 py-1.5 text-14 ${x.key === period.key ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
              {x.label}
            </Link>
          ))}
          <a href="/pos" target="_blank" rel="noopener" className="rounded-md bg-primary px-4 py-2 text-14 font-semibold text-primary-foreground">Buka kasir</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card k="Omzet" v={rupiah(omzet)} />
        <Card k="Transaksi" v={String(sales.length)} />
        <Card k="Rata-rata / transaksi" v={rupiah(sales.length ? omzet / sales.length : 0)} />
        <Card k="Barang terjual" v={String(items.reduce((n, i) => n + i.qty, 0))} />
        <Card k="Menunggu ACC cabang" v={String(pending)} sub={`${final} sudah final`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          title="Per cabang"
          head={["Cabang", "Password kasir", "Transaksi", "Omzet"]}
          empty="Belum ada cabang."
          rows={branches.map((b) => [
            b.name,
            <PosPassword key={b.id} branchId={b.id} active={!!b.posPasswordHash} />,
            byBranch.get(b.id)?.n ?? 0,
            rupiah(byBranch.get(b.id)?.sum ?? 0),
          ])}
        />
        <Table
          title="Per sales (dasar bonus)"
          head={["Sales", "Transaksi", "Omzet"]}
          empty="Belum ada penjualan."
          rows={bySales.map(([name, g]) => [name, g.n, rupiah(g.sum)])}
        />
        <Table
          title="Metode bayar"
          head={["Metode", "Jumlah"]}
          empty="Belum ada penjualan."
          rows={[...byMethod].sort((a, b) => b[1] - a[1]).map(([m, v]) => [m, rupiah(v)])}
        />
        <Table
          title="Barang terlaris"
          head={["Barang", "Qty", "Omzet"]}
          empty="Belum ada penjualan."
          rows={top.map(([name, g]) => [name, g.qty, rupiah(g.sum)])}
        />
      </div>

      <Table
        title="Transaksi terbaru"
        head={["Nota", "Waktu", "Cabang", "Kasir", "Sales", "Status", "Total"]}
        empty="Belum ada transaksi di periode ini."
        rows={sales.slice(0, 30).map((s) => [
          s.notaNo ?? "—",
          fmtWIB(s.soldAt),
          s.branchName ?? "—",
          s.employee ?? "—",
          s.salesman ?? "—",
          status(s),
          rupiah(s.grandTotal),
        ])}
      />

      <CabangClient
        branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, latitude: b.latitude, longitude: b.longitude, userCount: b._count.users }))}
      />
    </div>
  );
}
