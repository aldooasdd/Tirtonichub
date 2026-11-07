import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { ORDER_TABS, statusLabel, statusTone } from "@/lib/channel-status";
import { DEMO, PLATFORMS, PLATFORM_LABEL, apiReady } from "@/server/marketplace/sync";
import { ShopPanel } from "@/components/channel/shop-panel";
import { OrderActions } from "@/components/channel/order-actions";
import type { Prisma } from "@/generated/prisma";
import type { OrderFinance } from "@/server/marketplace/tiktok";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const TONE = { warn: "text-amber-600", ok: "text-emerald-600", bad: "text-destructive", muted: "text-muted-foreground" };
/** Rincian dana 1 order Tokopedia (Get Transactions by Order), bisa dibuka-tutup. */
function FinanceDetail({ f }: { f: OrderFinance }) {
  const row = (label: string, v: number, strong = false) => (
    <div key={label} className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground first-letter:uppercase"}>{label}</span>
      <span className={`tabular-nums ${v < 0 ? "text-destructive" : ""}`}>{rupiah(v)}</span>
    </div>
  );
  return (
    <details className="mt-1 text-12">
      <summary className="cursor-pointer text-primary">Rincian dana</summary>
      <div className="mt-1 space-y-0.5 rounded-md border bg-muted/30 p-2">
        {row("Penjualan", f.revenue, true)}
        {f.lines.filter((l) => l.group === "penjualan").map((l) => row(l.label, l.amount))}
        {row("Ongkos kirim", f.shipping, true)}
        {f.lines.filter((l) => l.group === "ongkir").map((l) => row(l.label, l.amount))}
        {row("Biaya & pajak", f.feeTax, true)}
        {f.lines.filter((l) => l.group === "potongan").map((l) => row(l.label, l.amount))}
        <div className="border-t pt-0.5">{row("Bersih diterima", f.settlement, true)}</div>
      </div>
    </details>
  );
}
const BAR = { warn: "bg-amber-500", ok: "bg-emerald-500", bad: "bg-destructive", muted: "bg-muted-foreground/40" };
const TAG = { SHOPEE: "bg-orange-500/15 text-orange-600", TOKOPEDIA: "bg-emerald-500/15 text-emerald-600" } as Record<string, string>;
const PER_PAGE = 20;
const ymd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
type Item = { name: string; sku: string | null; qty: number; price: number; image?: string | null };
type SP = { pesan?: string; tab?: string; q?: string; dari?: string; sampai?: string; p?: string; hal?: string };

/** Tirtonic Channel: koneksi toko + Kelola Pesanan (tab status, cari, filter tanggal & toko). */
export default async function ChannelPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireChannel();
  const sp = await searchParams;
  const tab = ORDER_TABS.find((t) => t.key === sp.tab) ?? ORDER_TABS[0];
  const platform = PLATFORMS.find((x) => x === sp.p);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const dari = ymd(sp.dari);
  const sampai = ymd(sp.sampai);
  const hal = Math.max(1, Number(sp.hal) || 1);

  // Filter dasar (toko + tanggal pesanan WIB) → dipakai hitungan tab & daftar.
  const base: Prisma.MarketplaceOrderWhereInput = {
    ...(platform ? { platform } : {}),
    ...(dari || sampai
      ? {
          orderedAt: {
            ...(dari ? { gte: new Date(`${dari}T00:00:00+07:00`) } : {}),
            ...(sampai ? { lt: new Date(new Date(`${sampai}T00:00:00+07:00`).getTime() + 86400_000) } : {}),
          },
        }
      : {}),
  };
  // Cari: no. pesanan, resi, pembeli, penerima, atau nama produk (items JSON).
  if (q) {
    const like = `%${q}%`;
    const hits = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "MarketplaceOrder"
      WHERE "orderSn" ILIKE ${like} OR "trackingNo" ILIKE ${like} OR buyer ILIKE ${like} OR recipient ILIKE ${like} OR items::text ILIKE ${like}
      LIMIT 2000`;
    base.id = { in: hits.map((h) => h.id) };
  }
  const where: Prisma.MarketplaceOrderWhereInput = { ...base, ...(tab.statuses ? { status: { in: [...tab.statuses] } } : {}) };

  const [shops, byStatus, total, orders] = await Promise.all([
    prisma.marketplaceShop.findMany(),
    prisma.marketplaceOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.marketplaceOrder.count({ where }),
    prisma.marketplaceOrder.findMany({ where, orderBy: { orderedAt: "desc" }, skip: (hal - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const countOf = (statuses: readonly string[] | null) =>
    byStatus.filter((s) => !statuses || statuses.includes(s.status)).reduce((n, s) => n + s._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const cards = PLATFORMS.map((p) => {
    const s = shops.find((x) => x.platform === p);
    return {
      platform: p,
      label: PLATFORM_LABEL[p],
      status: !s ? ("none" as const) : s.shopId === DEMO ? ("demo" as const) : ("live" as const),
      shopName: s?.shopName ?? null,
      lastSync: s?.lastSyncAt ? fmtWIB(s.lastSyncAt) : null,
      apiReady: apiReady(p),
    };
  });
  const shopName = new Map(shops.map((s) => [s.platform, s.shopName]));

  const href = (over: Partial<SP>) => {
    const v = { tab: tab.key === "semua" ? "" : tab.key, q, dari, sampai, p: platform ?? "", ...over };
    const u = new URLSearchParams(Object.entries(v).filter(([, x]) => x) as [string, string][]);
    return `/channel${u.size ? `?${u}` : ""}`;
  };
  const field = "h-9 rounded-md border bg-background px-2 text-14";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Tirtonic Channel</h1>
        <p className="text-14 text-muted-foreground">Toko Shopee & Tokopedia tersambung ke dashboard: order masuk sendiri, stok & dana cair terpantau.</p>
      </div>
      {sp.pesan && <p className="rounded-md border bg-card p-3 text-14">{sp.pesan}</p>}

      <ShopPanel shops={cards} anyDemo={shops.some((s) => s.shopId === DEMO)} />

      {/* Kelola Pesanan */}
      <section className="rounded-lg border bg-card">
        <div className="px-4 pt-4">
          <h2 className="text-18 font-semibold">Pesanan</h2>
        </div>
        <nav className="mt-2 flex gap-1 overflow-x-auto border-b px-2" aria-label="Status pesanan">
          {ORDER_TABS.map((t) => {
            const n = countOf(t.statuses);
            const active = t.key === tab.key;
            return (
              <Link
                key={t.key}
                href={href({ tab: t.key === "semua" ? "" : t.key, hal: "" })}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-14 whitespace-nowrap ${active ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
                {t.statuses && n > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-12 font-medium text-primary">{n}</span>}
              </Link>
            );
          })}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-2 p-4">
          {tab.key !== "semua" && <input type="hidden" name="tab" value={tab.key} />}
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-12 text-muted-foreground">
            Cari
            <input name="q" defaultValue={q} placeholder="Produk, nomor pesanan, resi, pembeli" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Toko
            <select name="p" defaultValue={platform ?? ""} className={field}>
              <option value="">Semua toko</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Dari
            <input type="date" name="dari" defaultValue={dari} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-12 text-muted-foreground">
            Sampai
            <input type="date" name="sampai" defaultValue={sampai} className={field} />
          </label>
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground">
            Terapkan
          </button>
          {(q || dari || sampai || platform) && (
            <Link href={href({ q: "", dari: "", sampai: "", p: "", hal: "" })} className="h-9 px-2 text-14 leading-9 text-muted-foreground">
              Reset
            </Link>
          )}
        </form>
      </section>

      <div className="flex items-center justify-between text-14 text-muted-foreground">
        <span>{total} pesanan</span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            {hal > 1 && (
              <Link href={href({ hal: String(hal - 1) })} className="rounded-md border px-2 py-1">
                Sebelumnya
              </Link>
            )}
            Hal {hal} / {pages}
            {hal < pages && (
              <Link href={href({ hal: String(hal + 1) })} className="rounded-md border px-2 py-1">
                Berikutnya
              </Link>
            )}
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Tidak ada pesanan di filter ini.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const items = (Array.isArray(o.items) ? o.items : []) as Item[];
            const qty = items.reduce((n, it) => n + (it.qty || 0), 0);
            const tone = statusTone(o.status);
            return (
              <article key={o.id} className="overflow-hidden rounded-lg border bg-card">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                  <span className={`h-5 w-1 rounded ${BAR[tone]}`} aria-hidden />
                  <span className={`font-semibold ${TONE[tone]}`}>{statusLabel(o.status)}</span>
                  <span className="text-14 text-muted-foreground">
                    Nomor Pesanan: <span className="font-mono text-foreground">{o.orderSn}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {o.shopId === DEMO && <span className="text-12 text-amber-600">contoh</span>}
                    <span className={`rounded px-2 py-0.5 text-12 font-medium ${TAG[o.platform] ?? "bg-muted"}`}>
                      {PLATFORM_LABEL[o.platform as keyof typeof PLATFORM_LABEL] ?? o.platform}
                      {shopName.get(o.platform) ? ` · ${shopName.get(o.platform)}` : ""}
                    </span>
                  </span>
                </header>

                <div className="grid gap-4 p-4 text-14 md:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {items.map((it, i) => (
                      <div key={i} className="flex gap-3">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- gambar dari CDN marketplace
                          <img src={it.image} alt="" className="size-14 shrink-0 rounded-md border object-cover" />
                        ) : (
                          <div className="size-14 shrink-0 rounded-md bg-muted" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium">{it.name}</p>
                          {it.sku && <p className="text-12 text-muted-foreground">SKU {it.sku}</p>}
                          <p className="text-12 text-muted-foreground">
                            Qty: {it.qty} × {rupiah(it.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="text-12 font-medium text-muted-foreground">Catatan Pembeli</p>
                      <p>{o.buyerNote || "-"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-12 font-medium text-muted-foreground">Total Qty</p>
                    <p>{qty}</p>
                  </div>
                  <div>
                    <p className="text-12 font-medium text-muted-foreground">Total Harga</p>
                    <p className="font-semibold">{rupiah(o.total)}</p>
                    {o.payment && <p className="text-12 text-muted-foreground">{o.payment}</p>}
                    {o.netAmount != null && <p className="mt-1 text-12 text-emerald-600">Settlement {rupiah(o.netAmount)}</p>}
                    {o.finance != null && <FinanceDetail f={o.finance as unknown as OrderFinance} />}
                  </div>
                  <div>
                    <p className="text-12 font-medium text-muted-foreground">Alamat</p>
                    <p>
                      {o.recipient || o.buyer || "-"}
                      {o.phone && <span className="text-muted-foreground"> ({o.phone})</span>}
                    </p>
                    <p className="text-muted-foreground">{o.address || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-12 font-medium text-muted-foreground">Tanggal Pesanan</p>
                      <p>{fmtWIB(o.orderedAt)}</p>
                    </div>
                    <div>
                      <p className="text-12 font-medium text-muted-foreground">Kurir</p>
                      <p>{o.courier || "-"}</p>
                    </div>
                    <div>
                      <p className="text-12 font-medium text-muted-foreground">Nomor Resi</p>
                      <p className="font-mono text-12">{o.trackingNo || "-"}</p>
                    </div>
                  </div>
                </div>
                {o.platform === "TOKOPEDIA" && o.shopId !== DEMO && (
                  <OrderActions o={{ id: o.id, status: o.status, shippingType: o.shippingType, packageId: o.packageId, trackingNo: o.trackingNo }} />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
