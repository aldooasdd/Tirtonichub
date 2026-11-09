// Tampilan Iklan Shopee lanjutan (server components): per jam, GMV Max, rekomendasi, buat iklan.
import Link from "next/link";
import { prisma } from "@/server/db";
import * as ads from "@/server/marketplace/shopee-ads";
import { AdCreate, GmsActions } from "@/components/channel/shopee-ads-ui";

type C = { token: string; shopId: string };
const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const num = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(2)}%` : "-");
const roas = (m: ads.Metric) => (m.expense ? (m.gmv / m.expense).toFixed(2) : "-");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");
const toShopee = (iso: string) => iso.split("-").reverse().join("-");
const field = "h-9 rounded-md border bg-background px-2 text-14";
const th = "p-3 text-right";
const td = "p-3 text-right tabular-nums whitespace-nowrap";

export const Err = ({ e }: { e: string }) => <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{e}</p>;

/** Nama produk Shopee per item_id (dari sinkron produk). */
export async function shopeeNames(): Promise<Map<string, string>> {
  const rows = await prisma.marketplaceItem.findMany({ where: { platform: "SHOPEE" }, select: { itemId: true, name: true, localName: true, variant: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.itemId)) m.set(r.itemId, r.localName ?? (r.variant && r.name.endsWith(` - ${r.variant}`) ? r.name.slice(0, -(r.variant.length + 3)) : r.name));
  return m;
}

export function MetricTable({ rows, first, label }: { rows: (ads.Metric & { key: string; label: React.ReactNode })[]; first: string; label?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-14">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="p-3">{first}</th>
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-6 text-center text-muted-foreground">{label ?? "Tidak ada data."}</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} className="border-b last:border-b-0">
                <td className="p-3">{r.label}</td>
                <td className={td}>{num(r.impression)}</td>
                <td className={td}>{num(r.clicks)}</td>
                <td className={td}>{pct(r.clicks, r.impression)}</td>
                <td className={td}>{rupiah(r.expense)}</td>
                <td className={td}>{num(r.order)}</td>
                <td className={td}>{rupiah(r.gmv)}</td>
                <td className={td}>{roas(r)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Per jam (semua iklan) pada 1 tanggal. */
export async function HourlyView({ c, date, today }: { c: C; date: string; today: string }) {
  let rows: (ads.Metric & { hour: number })[] = [];
  let e = "";
  try {
    rows = await ads.hourlyAll(c, toShopee(date));
  } catch (x) {
    e = errMsg(x);
  }
  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <input type="hidden" name="v" value="jam" />
        <label className="flex flex-col gap-1 text-12 text-muted-foreground">
          Tanggal
          <input type="date" name="d" defaultValue={date} max={today} className={field} />
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">Tampilkan</button>
      </form>
      {e && <Err e={e} />}
      <MetricTable first="Jam" rows={rows.map((r) => ({ ...r, key: String(r.hour), label: `${String(r.hour).padStart(2, "0")}:00` }))} />
    </>
  );
}

/** GMV Max: performa kampanye & per produk + buat/ubah. */
export async function GmsView({ c, from, to }: { c: C; from: string; to: string }) {
  const [el, camp, items, names] = await Promise.allSettled([ads.gmsEligibility(c), ads.gmsCampaign(c, toShopee(from), toShopee(to)), ads.gmsItems(c, toShopee(from), toShopee(to)), shopeeNames()]);
  const errs = [el, camp, items].filter((r) => r.status === "rejected").map((r) => errMsg((r as PromiseRejectedResult).reason));
  const cp = camp.status === "fulfilled" ? camp.value : null;
  const nm = names.status === "fulfilled" ? names.value : new Map<string, string>();
  const list = items.status === "fulfilled" ? items.value.sort((a, b) => b.expense - a.expense) : [];
  return (
    <>
      {errs.map((x) => <Err key={x} e={x} />)}
      {cp && <MetricTable first="Kampanye" rows={[{ ...cp.report, key: cp.campaignId, label: `GMV Max #${cp.campaignId}` }]} />}
      <GmsActions campaignId={cp?.campaignId || null} eligible={el.status === "fulfilled" && el.value.eligible} reason={el.status === "fulfilled" ? el.value.reason : ""} />
      <h2 className="text-18 font-semibold">Per produk ({list.length})</h2>
      <MetricTable first="Produk" rows={list.map((r) => ({ ...r, key: r.itemId, label: nm.get(r.itemId) ?? r.itemId }))} label="Belum ada data GMV Max." />
    </>
  );
}

/** Produk yang disarankan Shopee untuk diiklankan. */
export async function RecommendView({ c }: { c: C }) {
  let rows: Awaited<ReturnType<typeof ads.recommendedItems>> = [];
  let e = "";
  try {
    rows = await ads.recommendedItems(c);
  } catch (x) {
    e = errMsg(x);
  }
  const nm = await shopeeNames();
  return (
    <>
      {e && <Err e={e} />}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-14">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Produk</th>
              <th className="p-3">Label</th>
              <th className="p-3">Status</th>
              <th className="p-3">Iklan berjalan</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">Tidak ada saran.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.itemId} className="border-b last:border-b-0">
                  <td className="p-3">{nm.get(r.itemId) ?? r.itemId}</td>
                  <td className="p-3">{r.tags.join(", ") || "-"}</td>
                  <td className="p-3">{r.status.join(", ") || "-"}</td>
                  <td className="p-3">{r.ongoing.join(", ") || "-"}</td>
                  <td className="p-3">
                    <Link href={`/channel/iklan?v=buat&item=${r.itemId}`} className="font-medium text-primary hover:underline">Iklankan</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export async function CreateView({ item }: { item?: string }) {
  const nm = await shopeeNames();
  const items = [...nm].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  return <AdCreate items={items} defaultItem={item} />;
}
