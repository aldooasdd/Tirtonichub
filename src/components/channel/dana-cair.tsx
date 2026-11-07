import Link from "next/link";
import { prisma } from "@/server/db";
import type { OrderFinance } from "@/server/marketplace/tiktok";
import { fmtWIB } from "@/lib/datetime";
import { DEMO, PLATFORMS, PLATFORM_LABEL } from "@/server/marketplace/sync";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const monthNow = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

/** Dana cair marketplace per bulan: penjualan kotor, potongan, uang bersih.
 *  Dipakai di Tirtonic Channel (/channel/dana) dan Finance (/finance/online); akses dicek di page. */
type SP = { bulan?: string; tab?: string };
const PAY_STATUS: Record<string, { label: string; tone: string }> = {
  PAID: { label: "Sudah ditransfer", tone: "text-emerald-600" },
  PROCESSING: { label: "Diproses", tone: "text-amber-600" },
  FAILED: { label: "Gagal", tone: "text-destructive" },
};
const payStatus = (s: string | null) => (s ? (PAY_STATUS[s] ?? { label: s, tone: "text-muted-foreground" }) : null);
const TABS = [
  { key: "", label: "Ringkasan" },
  { key: "transfer", label: "Transfer ke Rekening" },
  { key: "biaya", label: "Biaya Marketplace" },
  { key: "produk", label: "Per Produk" },
];

/** `channel`: tampilkan tab keuangan lengkap (khusus Tirtonic Channel). */
export async function DanaCair({ searchParams, channel = false }: { searchParams: Promise<SP>; channel?: boolean }) {
  const sp = await searchParams;
  const tab = channel ? (sp.tab ?? "") : "";
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
      adjustment: rows.reduce((s, x) => s + x.adjustment, 0),
      count: rows.length,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Settlement Marketplace</h1>
          <p className="text-14 text-muted-foreground">Uang dari Shopee & Tokopedia per bulan: penjualan, potongan marketplace, dan uang bersih yang cair.</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Bulan
            <input type="month" name="bulan" defaultValue={bulan} className="h-9 rounded-md border bg-card px-2 text-14" />
          </label>
          {tab && <input type="hidden" name="tab" value={tab} />}
          <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">Terapkan</button>
        </form>
      </div>

      {channel && (
        <nav className="flex flex-wrap gap-1 border-b">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`?bulan=${bulan}${t.key ? `&tab=${t.key}` : ""}`}
              className={`-mb-px border-b-2 px-3 py-2 text-14 font-medium ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {tab === "transfer" && <Transfers from={from} to={to} />}
      {(tab === "biaya" || tab === "produk") && <OrderFinanceReport from={from} to={to} mode={tab} />}
      {tab === "" && (
        <>

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
              {s.adjustment !== 0 && ` · penyesuaian ${rupiah(s.adjustment)}`}
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
                {channel && <th className="p-3 text-right">Penyesuaian</th>}
                <th className="p-3 text-right">Bersih</th>
                {channel && <th className="p-3">Status</th>}
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
                  {channel && <td className="p-3 text-right tabular-nums">{x.adjustment ? rupiah(x.adjustment) : "-"}</td>}
                  <td className="p-3 text-right font-medium tabular-nums">{rupiah(x.amount)}</td>
                  {channel && (
                    <td className={`p-3 whitespace-nowrap ${payStatus(x.payStatus)?.tone ?? "text-muted-foreground"}`}>
                      {payStatus(x.payStatus)?.label ?? "-"}
                      {x.payTime && <span className="block text-12 text-muted-foreground">{fmtWIB(x.payTime)}</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">{children}</p>;

/** Transfer dana ke rekening bank (TikTok Shop Get Payments). */
async function Transfers({ from, to }: { from: Date; to: Date }) {
  const rows = await prisma.marketplaceTransfer.findMany({ where: { createdAtMp: { gte: from, lt: to } }, orderBy: { createdAtMp: "desc" } });
  if (!rows.length) return <Empty>Belum ada transfer ke rekening di bulan ini.</Empty>;
  const paid = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-12 text-muted-foreground">Sudah masuk rekening bulan ini</div>
        <div className="text-24 font-semibold tabular-nums">{rupiah(paid)}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b bg-card text-left text-muted-foreground">
              <th className="p-3">Dibuat</th>
              <th className="p-3">Toko</th>
              <th className="p-3">Rekening</th>
              <th className="p-3">Status</th>
              <th className="p-3">Masuk rekening</th>
              <th className="p-3 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = payStatus(r.status);
              return (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="p-3 whitespace-nowrap">{fmtWIB(r.createdAtMp)}</td>
                  <td className="p-3">{PLATFORM_LABEL[r.platform as keyof typeof PLATFORM_LABEL] ?? r.platform}</td>
                  <td className="p-3 font-mono text-12">{r.bankAccount ?? "-"}</td>
                  <td className={`p-3 whitespace-nowrap ${st?.tone ?? ""}`}>{st?.label ?? "-"}</td>
                  <td className="p-3 whitespace-nowrap">{r.paidTime ? fmtWIB(r.paidTime) : "-"}</td>
                  <td className="p-3 text-right font-medium tabular-nums">{rupiah(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GROUP_LABEL = { penjualan: "Penjualan", ongkir: "Ongkos kirim", potongan: "Biaya & pajak" } as const;

/** Laporan dari rincian dana per order (Get Transactions by Order): biaya per jenis, atau per produk. */
async function OrderFinanceReport({ from, to, mode }: { from: Date; to: Date; mode: "biaya" | "produk" }) {
  const orders = await prisma.marketplaceOrder.findMany({
    where: { platform: "TOKOPEDIA", orderedAt: { gte: from, lt: to }, status: "COMPLETED" },
    select: { finance: true },
  });
  const fins = orders.map((o) => o.finance as OrderFinance | null).filter((f): f is OrderFinance => !!f);
  const pending = orders.length - fins.length;
  const note = (
    <p className="text-12 text-muted-foreground">
      Dari {fins.length} order Tokopedia selesai yang dipesan bulan ini{pending ? ` · ${pending} order rinciannya belum tersedia (belum cair / masih disinkron)` : ""}.
    </p>
  );
  if (!fins.length) return <Empty>Belum ada rincian dana order Tokopedia di bulan ini.</Empty>;

  if (mode === "biaya") {
    const lines = new Map<string, { group: keyof typeof GROUP_LABEL; label: string; amount: number }>();
    for (const f of fins)
      for (const l of f.lines) {
        const cur = lines.get(l.key);
        lines.set(l.key, { group: l.group, label: l.label, amount: (cur?.amount ?? 0) + l.amount });
      }
    const tot = { revenue: 0, shipping: 0, feeTax: 0, settlement: 0 };
    for (const f of fins) {
      tot.revenue += f.revenue;
      tot.shipping += f.shipping;
      tot.feeTax += f.feeTax;
      tot.settlement += f.settlement;
    }
    const pct = (n: number) => (tot.revenue ? ` (${((Math.abs(n) / tot.revenue) * 100).toFixed(1)}%)` : "");
    return (
      <div className="space-y-3">
        {note}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Penjualan", tot.revenue, ""],
            ["Ongkos kirim", tot.shipping, pct(tot.shipping)],
            ["Biaya & pajak", tot.feeTax, pct(tot.feeTax)],
            ["Bersih", tot.settlement, ""],
          ].map(([label, v, p]) => (
            <div key={label as string} className="rounded-lg border bg-card p-4">
              <div className="text-12 text-muted-foreground">{label}</div>
              <div className="text-18 font-semibold tabular-nums">{rupiah(v as number)}</div>
              {p && <div className="text-12 text-muted-foreground">{p as string} dari penjualan</div>}
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => {
            const rows = [...lines.values()].filter((l) => l.group === g).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            return (
              <div key={g} className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 font-semibold">{GROUP_LABEL[g]}</h2>
                {rows.length ? (
                  <dl className="space-y-1.5 text-14">
                    {rows.map((l) => (
                      <div key={l.label} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground first-letter:uppercase">{l.label}</dt>
                        <dd className={`tabular-nums ${l.amount < 0 ? "text-destructive" : ""}`}>{rupiah(l.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-14 text-muted-foreground">-</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Per produk: jumlah terjual, penjualan, dan uang bersih per produk.
  const prods = new Map<string, { qty: number; revenue: number; settlement: number }>();
  for (const f of fins)
    for (const k of f.skus) {
      const name = k.product || k.sku || k.skuId;
      const cur = prods.get(name) ?? { qty: 0, revenue: 0, settlement: 0 };
      prods.set(name, { qty: cur.qty + k.qty, revenue: cur.revenue + k.revenue, settlement: cur.settlement + k.settlement });
    }
  const rows = [...prods].sort((a, b) => b[1].settlement - a[1].settlement);
  return (
    <div className="space-y-3">
      {note}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b bg-card text-left text-muted-foreground">
              <th className="p-3">Produk</th>
              <th className="p-3 text-right">Terjual</th>
              <th className="p-3 text-right">Penjualan</th>
              <th className="p-3 text-right">Bersih</th>
              <th className="p-3 text-right">Potongan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, r]) => (
              <tr key={name} className="border-b last:border-b-0">
                <td className="p-3">{name}</td>
                <td className="p-3 text-right tabular-nums">{r.qty}</td>
                <td className="p-3 text-right tabular-nums">{rupiah(r.revenue)}</td>
                <td className="p-3 text-right font-medium tabular-nums">{rupiah(r.settlement)}</td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">{r.revenue ? `${(((r.revenue - r.settlement) / r.revenue) * 100).toFixed(1)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
