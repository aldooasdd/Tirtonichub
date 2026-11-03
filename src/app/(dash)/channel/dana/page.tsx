import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { DEMO, PLATFORMS, PLATFORM_LABEL } from "@/server/marketplace/sync";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const monthNow = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

/** Dana cair marketplace per bulan: penjualan kotor, potongan, uang bersih. */
export default async function ChannelDanaPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireChannel();
  const sp = await searchParams;
  const bulan = sp.bulan && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : monthNow();
  const [y, m] = bulan.split("-").map(Number);
  const from = new Date(`${bulan}-01T00:00:00+07:00`);
  const to = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00+07:00`);

  const payouts = await prisma.marketplacePayout.findMany({ where: { paidAt: { gte: from, lt: to } }, orderBy: { paidAt: "desc" } });
  const sum = PLATFORMS.map((p) => {
    const rows = payouts.filter((x) => x.platform === p);
    return {
      p,
      revenue: rows.reduce((s, x) => s + x.revenue, 0),
      fee: rows.reduce((s, x) => s + x.fee, 0),
      amount: rows.reduce((s, x) => s + x.amount, 0),
      count: rows.length,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Dana Cair</h1>
          <p className="text-14 text-muted-foreground">Uang dari Shopee & Tokopedia per bulan: penjualan, potongan marketplace, dan uang bersih yang cair.</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Bulan
            <input type="month" name="bulan" defaultValue={bulan} className="h-9 rounded-md border bg-card px-2 text-14" />
          </label>
          <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">Terapkan</button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sum.map((s) => (
          <div key={s.p} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{PLATFORM_LABEL[s.p]}</h2>
              <span className="text-12 text-muted-foreground">{s.count} pencairan</span>
            </div>
            <div className="text-24 font-semibold tabular-nums">{rupiah(s.amount)}</div>
            <div className="text-12 text-muted-foreground">
              Penjualan {rupiah(s.revenue)} · potongan {rupiah(s.fee)}
              {s.revenue > 0 ? ` (${((s.fee / s.revenue) * 100).toFixed(1)}%)` : ""}
            </div>
          </div>
        ))}
      </div>

      {payouts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b bg-card text-left text-muted-foreground">
                <th className="p-3">Tanggal cair</th>
                <th className="p-3">Toko</th>
                <th className="p-3">Ref</th>
                <th className="p-3 text-right">Penjualan</th>
                <th className="p-3 text-right">Potongan</th>
                <th className="p-3 text-right">Bersih</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((x) => (
                <tr key={x.id} className="border-b last:border-b-0">
                  <td className="p-3 whitespace-nowrap">{fmtWIB(x.paidAt)}</td>
                  <td className="p-3">
                    {PLATFORM_LABEL[x.platform as keyof typeof PLATFORM_LABEL] ?? x.platform}
                    {x.shopId === DEMO && <span className="ml-1 text-12 text-amber-600">contoh</span>}
                  </td>
                  <td className="p-3 font-mono text-12">{x.refId}</td>
                  <td className="p-3 text-right tabular-nums">{rupiah(x.revenue)}</td>
                  <td className="p-3 text-right tabular-nums">{rupiah(x.fee)}</td>
                  <td className="p-3 text-right font-medium tabular-nums">{rupiah(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
