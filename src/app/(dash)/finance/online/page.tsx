import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { CHANNEL_LABEL, ONLINE_CHANNELS } from "@/lib/online-recon";
import { DEMO } from "@/server/marketplace/sync";
import { OnlineReconTable } from "@/components/finance/online-recon-table";

function monthNow(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

/** Dompet online per bulan: nominal uang Shopee / Tokopedia / Website (diisi Finance). */
export default async function FinanceOnlinePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireFinance();
  const sp = await searchParams;
  const bulan = sp.bulan && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : monthNow();

  const [y, m] = bulan.split("-").map(Number);
  const from = new Date(`${bulan}-01T00:00:00+07:00`);
  const to = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00+07:00`);

  const [saved, cair] = await Promise.all([
    prisma.onlineRecon.findMany({ where: { month: bulan } }),
    // Dana cair dari API marketplace (Tirtonic Channel), tanpa data Mode Contoh.
    prisma.marketplacePayout.groupBy({
      by: ["platform"],
      where: { paidAt: { gte: from, lt: to }, shopId: { not: DEMO } },
      _sum: { amount: true },
    }),
  ]);
  const byCh = new Map(saved.map((s) => [s.channel, s]));
  const cairBy = new Map(cair.map((c) => [c.platform, c._sum.amount ?? 0]));
  const rows = ONLINE_CHANNELS.map((c) => ({
    channel: c,
    label: CHANNEL_LABEL[c],
    actual: byCh.get(c)?.actual ?? null,
    note: byCh.get(c)?.note ?? "",
    cair: cairBy.has(c) ? cairBy.get(c)! : null,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Dompet Online</h1>
          <p className="text-14 text-muted-foreground">Nominal uang Shopee, Tokopedia & Website per bulan.</p>
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
