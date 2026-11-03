import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { CHANNEL_LABEL, ONLINE_CHANNELS, channelOf, monthRange, type OnlineChannel } from "@/lib/online-recon";
import { OnlineReconTable } from "@/components/finance/online-recon-table";

type Pay = { method: string; amount: number };

function monthNow(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

/** Rekap penjualan online per bulan: total di app (metode bayar Shopee/Tokopedia/Website) vs uang asli. */
export default async function FinanceOnlinePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireFinance();
  const sp = await searchParams;
  const bulan = sp.bulan && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : monthNow();
  const { from, to } = monthRange(bulan);

  const [reports, saved] = await Promise.all([
    prisma.salesReport.findMany({
      where: { approvedAt: { not: null }, soldAt: { gte: from, lt: to } },
      select: { id: true, payments: true },
    }),
    prisma.onlineRecon.findMany({ where: { month: bulan } }),
  ]);

  const app = Object.fromEntries(ONLINE_CHANNELS.map((c) => [c, { total: 0, notas: new Set<string>() }])) as Record<
    OnlineChannel,
    { total: number; notas: Set<string> }
  >;
  for (const r of reports) {
    for (const p of (Array.isArray(r.payments) ? r.payments : []) as Pay[]) {
      const ch = channelOf(p?.method);
      if (!ch || !p.amount) continue;
      app[ch].total += p.amount;
      app[ch].notas.add(r.id);
    }
  }
  const byCh = new Map(saved.map((s) => [s.channel, s]));
  const rows = ONLINE_CHANNELS.map((c) => ({
    channel: c,
    label: CHANNEL_LABEL[c],
    appTotal: app[c].total,
    notaCount: app[c].notas.size,
    actual: byCh.get(c)?.actual ?? null,
    note: byCh.get(c)?.note ?? "",
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Rekap Online</h1>
          <p className="text-14 text-muted-foreground">
            Penjualan Shopee, Tokopedia & Website per bulan: total di app vs uang asli. Selisih ≠ 0 = perlu dicek.
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
      <OnlineReconTable key={bulan} month={bulan} rows={rows} />
    </div>
  );
}
