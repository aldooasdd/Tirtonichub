import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import { shopeeAdsBalance, shopeeAdsCampaigns, shopeeAdsDaily, type AdsCampaign, type AdsDay, type AdsMetric } from "@/server/marketplace/shopee";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const num = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(2)}%` : "-");
const roas = (m: AdsMetric) => (m.expense ? (m.gmv / m.expense).toFixed(2) : "-");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");

/** "YYYY-MM-DD" (input date) ↔ "DD-MM-YYYY" (Shopee Ads). Tanggal WIB. */
const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const toShopee = (iso: string) => iso.split("-").reverse().join("-");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type SP = { from?: string; to?: string };

/** Rentang tanggal dari URL; default 7 hari terakhir. */
function range(sp: SP) {
  const today = wibDate(new Date());
  let to = sp.to && ISO.test(sp.to) && sp.to <= today ? sp.to : today;
  let from = sp.from && ISO.test(sp.from) ? sp.from : wibDate(new Date(Date.now() - 6 * 86400_000));
  if (from > to) [from, to] = [to, from];
  // ponytail: batas 30 hari per tarikan biar respons cepat; perpanjang kalau Shopee & user butuh.
  const minFrom = wibDate(new Date(new Date(to).getTime() - 29 * 86400_000));
  if (from < minFrom) from = minFrom;
  return { today, from, to };
}

/** Iklan Shopee: saldo iklan, performa harian & per iklan produk. Data langsung dari Shopee Ads API. */
export default async function IklanPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const { today, from, to } = range(sp);

  const head = (
    <div>
      <h1 className="text-24 font-semibold">Iklan Shopee</h1>
      <p className="text-14 text-muted-foreground">Biaya & hasil iklan (Shopee Ads) langsung dari Shopee. Maksimal 30 hari sekali tarik.</p>
    </div>
  );
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO)
    return (
      <div className="space-y-5">
        {head}
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Shopee asli dulu di Kelola Pesanan.</p>
      </div>
    );

  const s = await fresh(shop);
  const [a, b, c] = await Promise.allSettled([
    shopeeAdsBalance(s.accessToken, s.shopId),
    shopeeAdsDaily(s.accessToken, s.shopId, toShopee(from), toShopee(to)),
    shopeeAdsCampaigns(s.accessToken, s.shopId, toShopee(from), toShopee(to)),
  ]);
  const balance = a.status === "fulfilled" ? a.value : null;
  const days: AdsDay[] = b.status === "fulfilled" ? b.value : [];
  const camps: AdsCampaign[] = c.status === "fulfilled" ? c.value.filter((x) => x.impression || x.expense).sort((x, y) => y.expense - x.expense) : [];
  const errors = [a, b, c].filter((r) => r.status === "rejected").map((r) => errMsg((r as PromiseRejectedResult).reason));
  const tot = days.reduce<AdsMetric>(
    (t, d) => ({ impression: t.impression + d.impression, clicks: t.clicks + d.clicks, expense: t.expense + d.expense, order: t.order + d.order, gmv: t.gmv + d.gmv, itemSold: t.itemSold + d.itemSold }),
    { impression: 0, clicks: 0, expense: 0, order: 0, gmv: 0, itemSold: 0 },
  );
  const field = "h-9 rounded-md border bg-background px-2 text-14";
  const th = "p-3 text-right";
  const td = "p-3 text-right tabular-nums whitespace-nowrap";

  return (
    <div className="space-y-5">
      {head}
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Dari
          <input type="date" name="from" defaultValue={from} max={today} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Sampai
          <input type="date" name="to" defaultValue={to} max={today} className={field} />
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">
          Tarik data
        </button>
      </form>

      {errors.length > 0 && (
        <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-14 text-destructive">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          <p className="text-12">Kalau error izin (permission / access denied): aktifkan modul Ads di app Shopee Open Platform, lalu Sambungkan ulang toko Shopee.</p>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Saldo iklan", balance == null ? "-" : rupiah(balance)],
          ["Biaya iklan", rupiah(tot.expense)],
          ["Penjualan dari iklan", rupiah(tot.gmv)],
          ["ROAS", roas(tot)],
          ["Pesanan", num(tot.order)],
          ["Klik (CTR)", `${num(tot.clicks)} (${pct(tot.clicks, tot.impression)})`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-card p-4">
            <p className="text-12 text-muted-foreground">{k}</p>
            <p className="text-18 font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Per hari</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Tanggal</th>
                <th className={th}>Dilihat</th>
                <th className={th}>Klik</th>
                <th className={th}>CTR</th>
                <th className={th}>Biaya</th>
                <th className={th}>Pesanan</th>
                <th className={th}>Penjualan</th>
                <th className={th}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                days.map((d) => (
                  <tr key={d.date} className="border-b last:border-b-0">
                    <td className="p-3 whitespace-nowrap">{d.date.replaceAll("-", "/")}</td>
                    <td className={td}>{num(d.impression)}</td>
                    <td className={td}>{num(d.clicks)}</td>
                    <td className={td}>{pct(d.clicks, d.impression)}</td>
                    <td className={td}>{rupiah(d.expense)}</td>
                    <td className={td}>{num(d.order)}</td>
                    <td className={td}>{rupiah(d.gmv)}</td>
                    <td className={td}>{roas(d)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Per iklan produk ({camps.length})</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-14">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Iklan</th>
                <th className={th}>Dilihat</th>
                <th className={th}>Klik</th>
                <th className={th}>Biaya</th>
                <th className={th}>Pesanan</th>
                <th className={th}>Penjualan</th>
                <th className={th}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {camps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Tidak ada iklan produk yang jalan di rentang ini.
                  </td>
                </tr>
              ) : (
                camps.map((x) => (
                  <tr key={x.id} className="border-b align-top last:border-b-0">
                    <td className="p-3">
                      <span className="line-clamp-2 font-medium">{x.name}</span>
                      <span className="text-12 text-muted-foreground">
                        {x.type === "auto" ? "Otomatis" : x.type === "manual" ? "Manual" : x.type}
                        {x.placement ? ` · ${x.placement}` : ""}
                      </span>
                    </td>
                    <td className={td}>{num(x.impression)}</td>
                    <td className={td}>{num(x.clicks)}</td>
                    <td className={td}>{rupiah(x.expense)}</td>
                    <td className={td}>{num(x.order)}</td>
                    <td className={td}>{rupiah(x.gmv)}</td>
                    <td className={td}>{roas(x)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
