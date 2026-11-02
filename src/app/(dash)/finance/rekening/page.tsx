import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { akunOf, TAK_TERPETAKAN } from "@/lib/rekening";

type Pay = { method: string; amount: number };
const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

function monthNow(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

/** Rekap uang masuk per rekening: metode bayar tiap nota (yang sudah di-ACC) → rekening tujuan. */
export default async function FinanceRekeningPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireFinance();
  const sp = await searchParams;
  const bulan = sp.bulan && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : monthNow();
  // Rentang bulan WIB → UTC.
  const from = new Date(`${bulan}-01T00:00:00+07:00`);
  const [y, m] = bulan.split("-").map(Number);
  const to = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00+07:00`);

  const reports = await prisma.salesReport.findMany({
    where: { approvedAt: { not: null }, soldAt: { gte: from, lt: to } },
    orderBy: { soldAt: "asc" },
    select: { id: true, notaNo: true, soldAt: true, branchName: true, channel: true, payments: true },
  });

  type Tx = { id: string; tgl: string; nota: string; cabang: string; method: string; amount: number };
  const akun = new Map<string, Tx[]>();
  for (const r of reports) {
    for (const p of (Array.isArray(r.payments) ? r.payments : []) as Pay[]) {
      if (!p?.amount) continue;
      const a = akunOf(p.method);
      const list = akun.get(a) ?? [];
      list.push({
        id: r.id,
        tgl: fmtWIB(r.soldAt),
        nota: r.notaNo || "-",
        cabang: r.branchName || (r.channel === "online" ? "Online" : "-"),
        method: p.method || "-",
        amount: p.amount,
      });
      akun.set(a, list);
    }
  }
  const groups = [...akun.entries()]
    .map(([name, txs]) => ({ name, txs, total: txs.reduce((s, t) => s + t.amount, 0) }))
    .sort((a, b) => (a.name === TAK_TERPETAKAN ? 1 : b.name === TAK_TERPETAKAN ? -1 : b.total - a.total));
  const grand = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Rekening</h1>
          <p className="text-14 text-muted-foreground">
            Uang masuk per rekening dari metode bayar nota penjualan yang sudah di-ACC.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Bulan
            <input type="month" name="bulan" defaultValue={bulan} className="h-9 rounded-md border bg-card px-2 text-14" />
          </label>
          <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">Terapkan</button>
        </form>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-12 text-muted-foreground">Total masuk {bulan}</div>
        <div className="text-24 font-semibold tabular-nums">{rp(grand)}</div>
      </div>

      {groups.length === 0 && <p className="text-14 text-muted-foreground">Belum ada transaksi di bulan ini.</p>}

      <div className="space-y-3">
        {groups.map((g) => (
          <details key={g.name} className="rounded-lg border bg-card">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
              <span className={g.name === TAK_TERPETAKAN ? "font-semibold text-destructive" : "font-semibold"}>
                {g.name}
                <span className="ml-2 text-12 font-normal text-muted-foreground">{g.txs.length} transaksi</span>
              </span>
              <span className="font-semibold tabular-nums">{rp(g.total)}</span>
            </summary>
            {g.name === TAK_TERPETAKAN && (
              <p className="px-4 pb-2 text-12 text-destructive">
                Nama metode di nota tak ada di tabel rekening. Benarkan metode bayar di Rekap Penjualan.
              </p>
            )}
            <div className="overflow-x-auto border-t">
              <table className="w-full text-14">
                <thead className="text-left text-12 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Tanggal</th>
                    <th className="px-4 py-2">No Nota</th>
                    <th className="px-4 py-2">Cabang</th>
                    <th className="px-4 py-2">Metode</th>
                    <th className="px-4 py-2 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {g.txs.map((t, i) => (
                    <tr key={`${t.id}-${i}`} className="border-t">
                      <td className="whitespace-nowrap px-4 py-2">{t.tgl}</td>
                      <td className="px-4 py-2">{t.nota}</td>
                      <td className="px-4 py-2">{t.cabang}</td>
                      <td className="px-4 py-2">{t.method}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{rp(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
