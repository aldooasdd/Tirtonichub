import Link from "next/link";
import { ShopeeGudang } from "@/components/channel/shopee-gudang";
import { requireChannel } from "@/server/auth/rbac";
import { DEMO, activeShop, fresh } from "@/server/marketplace/sync";
import * as ops from "@/server/marketplace/tiktok-ops";
import { authorizedCategoryAssets } from "@/server/marketplace/tiktok-product";

const WH_TYPE: Record<string, string> = { SALES_WAREHOUSE: "Gudang kirim", RETURN_WAREHOUSE: "Gudang retur" };
const OPT_TYPE: Record<string, string> = {
  STANDARD: "Reguler",
  EXPRESS: "Ekspres",
  ECONOMY: "Ekonomi",
  SEND_BY_SELLER: "Kirim sendiri",
  INSTANT: "Instan",
  SAMEDAY: "Same day",
  NEXTDAY: "Next day",
  CARGO: "Kargo",
};

/** Gudang & Pengiriman Tokopedia: status toko, daftar gudang, opsi pengiriman aktif per gudang. */
export default async function GudangPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireChannel();
  const isShopee = (await searchParams).p === "SHOPEE";
  const tabs = (
    <nav className="flex gap-2">
      <Link href="/channel/gudang" className={`rounded-md px-3 py-1.5 text-14 font-medium ${!isShopee ? "bg-emerald-500/15 text-emerald-600" : "border text-muted-foreground"}`}>Tokopedia</Link>
      <Link href="/channel/gudang?p=SHOPEE" className={`rounded-md px-3 py-1.5 text-14 font-medium ${isShopee ? "bg-orange-500/15 text-orange-600" : "border text-muted-foreground"}`}>Shopee</Link>
    </nav>
  );
  if (isShopee)
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-24 font-semibold">Gudang & Pengiriman</h1>
          <p className="text-14 text-muted-foreground">Alamat toko dan kurir Shopee. Data langsung dari Shopee.</p>
        </div>
        {tabs}
        <ShopeeGudang />
      </div>
    );
  const shop = await activeShop("TOKOPEDIA");
  const head = (
    <div>
      <h1 className="text-24 font-semibold">Gudang & Pengiriman</h1>
      <p className="text-14 text-muted-foreground">Gudang toko Tokopedia dan opsi pengiriman yang aktif di tiap gudang. Data langsung dari Tokopedia.</p>
    </div>
  );
  if (!shop || shop.shopId === DEMO)
    return (
      <div className="space-y-5">
        {head}
        {tabs}
        <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Sambungkan toko Tokopedia asli dulu di Kelola Pesanan.</p>
      </div>
    );

  let error = "";
  let shops: { id: string; region: string }[] = [];
  let assets: { id: number; name: string; market: string }[] = [];
  let whs: (ops.Warehouse & { options: ops.DeliveryOption[] | null })[] = [];
  try {
    const s = await fresh(shop);
    const c = { token: s.accessToken, cipher: s.cipher ?? "" };
    const [act, list, cat] = await Promise.all([ops.activeShops(c).catch(() => []), ops.warehouses(c), authorizedCategoryAssets(s.accessToken).catch(() => [])]);
    shops = act;
    assets = cat;
    whs = await Promise.all(
      list.map(async (w) => ({ ...w, options: w.type === "SALES_WAREHOUSE" ? await ops.warehouseDeliveryOptions(c, w.id).catch(() => null) : null })),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal mengambil data.";
  }

  return (
    <div className="space-y-5">
      {head}
      {tabs}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-card p-4 text-14">
        <span>
          <span className="text-muted-foreground">Toko: </span>
          <span className="font-medium">{shop.shopName ?? shop.shopId}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Status: </span>
          {shops.some((x) => x.id === shop.shopId) ? (
            <span className="font-medium text-emerald-600">Aktif</span>
          ) : shops.length ? (
            <span className="font-medium text-amber-600">Tidak ada di daftar toko aktif</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
        {assets.length > 0 && (
          <span>
            <span className="text-muted-foreground">Kategori bisnis app: </span>
            {assets.map((a) => `${a.name}${a.market ? ` (${a.market})` : ""}`).join(", ")}
          </span>
        )}
        {shops[0]?.region && (
          <span>
            <span className="text-muted-foreground">Wilayah: </span>
            {shops[0].region}
          </span>
        )}
      </section>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-14 text-destructive">{error}</p>}
      {!error && whs.length === 0 && <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">Belum ada gudang.</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {whs.map((w) => (
          <article key={w.id} className="space-y-3 rounded-lg border bg-card p-4">
            <header className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{w.name}</h2>
              <span className="rounded bg-muted px-1.5 py-0.5 text-12">{WH_TYPE[w.type] ?? w.type}</span>
              {w.isDefault && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-12 font-medium text-primary">Utama</span>}
              <span className={`ml-auto text-12 font-medium ${w.status === "ENABLED" ? "text-emerald-600" : "text-destructive"}`}>
                {w.status === "ENABLED" ? "Stok dijual" : "Stok tidak dijual"}
              </span>
            </header>
            <div className="text-14">
              <p>{w.address ?? "-"}</p>
              {w.contact && <p className="text-muted-foreground">{w.contact}</p>}
              <p className="font-mono text-12 text-muted-foreground">ID {w.id}</p>
            </div>
            {w.options && (
              <div>
                <h3 className="mb-1.5 text-12 font-medium text-muted-foreground">Opsi pengiriman aktif</h3>
                {w.options.length === 0 ? (
                  <p className="text-14 text-muted-foreground">-</p>
                ) : (
                  <ul className="space-y-1 text-14">
                    {w.options.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{o.name}</span>
                        <span className="text-12 text-muted-foreground">{OPT_TYPE[o.type] ?? o.type}</span>
                        {o.platforms.length > 0 && <span className="text-12 text-muted-foreground">· {o.platforms.map((p) => (p === "TIKTOK_SHOP" ? "TikTok" : "Tokopedia")).join(", ")}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
