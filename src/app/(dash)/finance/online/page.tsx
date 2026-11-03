import { requireFinance } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { CHANNEL_LABEL, ONLINE_CHANNELS } from "@/lib/online-recon";
import { OnlineReconTable } from "@/components/finance/online-recon-table";

function monthNow(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

/** Dompet online per bulan: nominal uang Shopee / Tokopedia / Website (diisi Finance). */
export default async function FinanceOnlinePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await requireFinance();
  const sp = await searchParams;
  const bulan = sp.bulan && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : monthNow();

  const saved = await prisma.onlineRecon.findMany({ where: { month: bulan } });
  const byCh = new Map(saved.map((s) => [s.channel, s]));
  const rows = ONLINE_CHANNELS.map((c) => ({
    channel: c,
    label: CHANNEL_LABEL[c],
    actual: byCh.get(c)?.actual ?? null,
    note: byCh.get(c)?.note ?? "",
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
