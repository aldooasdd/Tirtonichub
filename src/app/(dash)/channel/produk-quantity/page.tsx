import Link from "next/link";
import { requireChannel } from "@/server/auth/rbac";
import { buildCatalog, tokoGudang } from "@/server/pos-catalog";
import { ProdukQuantity, type QtyRow } from "@/components/channel/produk-quantity";

/** Stok tiap barang (per SKU) dipecah per cabang. Sumber: stok gudang marketplace yang dipetakan ke cabang di Tirtonic POS. */
export default async function ProdukQuantityPage() {
  await requireChannel();
  const stores = await tokoGudang();
  const catalog = await buildCatalog(null, stores);
  const mapped = stores.some((b) => b.keys.length);

  const rows: QtyRow[] = catalog.items.map((it) => {
    const per: Record<string, number> = {};
    let other = 0;
    for (const s of it.stocks) {
      if (s.branchId) per[s.branchId] = (per[s.branchId] ?? 0) + s.stock;
      else other += s.stock;
    }
    const total = it.stocks.length ? it.stocks.reduce((n, s) => n + s.stock, 0) : it.stock;
    return { key: it.key, sku: it.sku, name: it.name, variant: it.variant, img: it.img, price: it.price, per, other, total };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-24 font-semibold">Stok Gudang</h1>
        <p className="text-14 text-muted-foreground">Stok tiap barang per cabang. Barang ber-SKU saja; SKU sama di Shopee & Tokopedia dihitung satu. Klik angka stok untuk mengubah.</p>
      </div>
      {!mapped && (
        <p className="rounded-md border border-warning bg-warning/10 p-3 text-14">
          Gudang belum dipetakan ke cabang, jadi stok cabang masih kosong. Atur di{" "}
          <Link href="/channel/pos" className="text-primary underline">Tirtonic POS → Per cabang → Gudang</Link>.
        </p>
      )}
      <ProdukQuantity rows={rows} branches={stores.map((b) => ({ id: b.id, name: b.label, bisa: b.keys.length > 0 }))} />
    </div>
  );
}
