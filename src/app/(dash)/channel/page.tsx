import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { fmtWIB } from "@/lib/datetime";
import { statusLabel, statusTone } from "@/lib/channel-status";
import { DEMO, PLATFORMS, PLATFORM_LABEL, apiReady } from "@/server/marketplace/sync";
import { ShopPanel } from "@/components/channel/shop-panel";

const rupiah = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const TONE = { warn: "text-amber-600", ok: "text-emerald-600", bad: "text-destructive", muted: "text-muted-foreground" };
type Item = { name: string; sku: string | null; qty: number; price: number };

export default async function ChannelPage({ searchParams }: { searchParams: Promise<{ pesan?: string; p?: string; perlu?: string }> }) {
  await requireChannel();
  const sp = await searchParams;
  const platform = PLATFORMS.find((x) => x === sp.p);
  const perlu = sp.perlu === "1";

  const [shops, orders, perluKirim] = await Promise.all([
    prisma.marketplaceShop.findMany(),
    prisma.marketplaceOrder.findMany({
      where: { ...(platform ? { platform } : {}), ...(perlu ? { status: { in: ["READY_TO_SHIP", "AWAITING_SHIPMENT", "RETRY_SHIP"] } } : {}) },
      orderBy: { orderedAt: "desc" },
      take: 100,
    }),
    prisma.marketplaceOrder.count({ where: { status: { in: ["READY_TO_SHIP", "AWAITING_SHIPMENT", "RETRY_SHIP"] } } }),
  ]);

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
  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} className={active ? "rounded-md bg-primary px-3 py-1.5 text-14 font-medium text-primary-foreground" : "rounded-md border px-3 py-1.5 text-14"}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-24 font-semibold">Tirtonic Channel</h1>
        <p className="text-14 text-muted-foreground">Toko Shopee & Tokopedia tersambung ke dashboard: order masuk sendiri, stok & dana cair terpantau.</p>
      </div>
      {sp.pesan && <p className="rounded-md border bg-card p-3 text-14">{sp.pesan}</p>}

      <ShopPanel shops={cards} anyDemo={shops.some((s) => s.shopId === DEMO)} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-16 font-semibold">Order</h2>
          {tab("Semua", "/channel", !platform && !perlu)}
          {PLATFORMS.map((p) => tab(PLATFORM_LABEL[p], `/channel?p=${p}`, platform === p && !perlu))}
          {tab(`Perlu dikirim (${perluKirim})`, "/channel?perlu=1", perlu)}
        </div>
        {orders.length === 0 ? (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada order. Sambungkan toko atau mulai Mode Contoh.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-14">
              <thead>
                <tr className="border-b bg-card text-left text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Toko</th>
                  <th className="p-3">No. Order</th>
                  <th className="p-3">Pembeli</th>
                  <th className="p-3">Barang</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Dana cair</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Resi</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b align-top last:border-b-0">
                    <td className="p-3 whitespace-nowrap">{fmtWIB(o.orderedAt)}</td>
                    <td className="p-3">
                      {PLATFORM_LABEL[o.platform as keyof typeof PLATFORM_LABEL] ?? o.platform}
                      {o.shopId === DEMO && <span className="ml-1 text-12 text-amber-600">contoh</span>}
                    </td>
                    <td className="p-3 font-mono text-12">{o.orderSn}</td>
                    <td className="p-3">{o.buyer ?? "-"}</td>
                    <td className="p-3">
                      {((o.items as Item[]) ?? []).map((it, i) => (
                        <div key={i}>
                          {it.qty}× {it.name}
                        </div>
                      ))}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{rupiah(o.total)}</td>
                    <td className="p-3 text-right whitespace-nowrap">{o.netAmount != null ? rupiah(o.netAmount) : "-"}</td>
                    <td className={`p-3 whitespace-nowrap font-medium ${TONE[statusTone(o.status)]}`}>{statusLabel(o.status)}</td>
                    <td className="p-3 font-mono text-12">{o.trackingNo ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
