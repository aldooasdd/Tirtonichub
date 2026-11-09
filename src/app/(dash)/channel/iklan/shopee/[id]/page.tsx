import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import * as ads from "@/server/marketplace/shopee-ads";
import { AdActions, KeywordEditor } from "@/components/channel/shopee-ads-ui";
import { Err, MetricTable, shopeeNames } from "@/components/channel/shopee-ads-views";
import { fmtWIB } from "@/lib/datetime";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal mengambil data.");
const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const toShopee = (iso: string) => iso.split("-").reverse().join("-");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUS: Record<string, string> = { ongoing: "Berjalan", scheduled: "Terjadwal", ended: "Selesai", paused: "Dijeda", deleted: "Dihapus", closed: "Ditutup" };

function dates(sp: { d?: string }) {
  const today = wibDate(new Date());
  return { today, day: sp.d && ISO.test(sp.d) ? sp.d : today, from: wibDate(new Date(Date.now() - 29 * 86400_000)) };
}

/** Detail 1 iklan produk Shopee: pengaturan, keyword, performa harian & per jam, aksi. */
export default async function IklanShopeeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  await requireChannel();
  const { id } = await params;
  const { today, day, from } = dates(await searchParams);
  const back = (
    <Link href="/channel/iklan" className="inline-flex items-center gap-1 text-14 text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" /> Iklan
    </Link>
  );
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) return <div className="space-y-5">{back}<Err e="Toko Shopee belum tersambung." /></div>;
  const s = await fresh(shop);
  const c = { token: s.accessToken, shopId: s.shopId };
  const [set, daily, hourly, names] = await Promise.allSettled([
    ads.campaignSettings(c, [id]),
    ads.dailyCampaign(c, toShopee(from), toShopee(today), id),
    ads.hourlyCampaign(c, toShopee(day), id),
    shopeeNames(),
  ]);
  const errs = [set, daily, hourly].filter((r) => r.status === "rejected").map((r) => errMsg((r as PromiseRejectedResult).reason));
  const cs = set.status === "fulfilled" ? set.value[0] : undefined;
  const nm = names.status === "fulfilled" ? names.value : new Map<string, string>();
  const field = "h-9 rounded-md border bg-background px-2 text-14";

  return (
    <div className="space-y-5">
      {back}
      <div>
        <h1 className="text-24 font-semibold">{cs?.name ?? `Iklan #${id}`}</h1>
        {cs && (
          <p className="text-14 text-muted-foreground">
            {STATUS[cs.status] ?? cs.status} · {cs.type === "auto" ? "Produk otomatis" : "Produk manual"} · bid {cs.bidding === "auto" ? "otomatis" : "manual"} · tampil di {cs.placement || "-"} · budget{" "}
            {cs.budget ? rupiah(cs.budget) : "tanpa batas"} · {cs.start ? fmtWIB(new Date(cs.start * 1000)) : "-"} s/d {cs.end ? fmtWIB(new Date(cs.end * 1000)) : "tanpa batas"}
            {cs.roasTarget ? ` · target ROAS ${cs.roasTarget}` : ""}
          </p>
        )}
      </div>
      {errs.map((e) => <Err key={e} e={e} />)}
      {cs && <AdActions id={id} status={cs.status} budget={cs.budget} roasTarget={cs.roasTarget} bidding={cs.bidding} />}

      {cs && (cs.itemIds.length > 0 || cs.autoProducts.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-18 font-semibold">Produk</h2>
          <ul className="divide-y rounded-lg border bg-card text-14">
            {cs.autoProducts.length
              ? cs.autoProducts.map((p) => (
                  <li key={p.itemId} className="flex justify-between gap-3 p-3">
                    <span>{p.name || nm.get(p.itemId) || p.itemId}</span>
                    <span className="text-muted-foreground">{p.status}</span>
                  </li>
                ))
              : cs.itemIds.map((i) => (
                  <li key={i} className="p-3">{nm.get(i) ?? i}</li>
                ))}
          </ul>
        </section>
      )}

      {cs?.bidding === "manual" && (
        <section className="space-y-2">
          <h2 className="text-18 font-semibold">Keyword</h2>
          <KeywordEditor id={id} itemId={cs.itemIds[0] ?? ""} keywords={cs.keywords} />
          {cs.locations.length > 0 && (
            <p className="text-14 text-muted-foreground">Lokasi discovery: {cs.locations.map((l) => `${l.location} (${l.status}, ${rupiah(l.bid)})`).join(", ")}</p>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-18 font-semibold">Per hari (30 hari)</h2>
        <MetricTable first="Tanggal" rows={(daily.status === "fulfilled" ? daily.value : []).map((r) => ({ ...r, key: r.date, label: r.date.replaceAll("-", "/") }))} />
      </section>
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-18 font-semibold">Per jam</h2>
          <form method="get" className="flex items-end gap-2">
            <input type="date" name="d" defaultValue={day} max={today} className={field} />
            <button type="submit" className="h-9 rounded-md border px-3 text-14 font-medium">Tampilkan</button>
          </form>
        </div>
        <MetricTable first="Jam" rows={(hourly.status === "fulfilled" ? hourly.value : []).map((r) => ({ ...r, key: String(r.hour), label: `${String(r.hour).padStart(2, "0")}:00` }))} />
      </section>
    </div>
  );
}
