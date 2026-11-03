import { requireChannel } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { DEMO } from "@/server/marketplace/sync";
import { ItemTable } from "@/components/channel/item-table";

export default async function ChannelProdukPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireChannel();
  const q = (await searchParams).q?.trim() ?? "";
  const items = await prisma.marketplaceItem.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: [{ stock: "asc" }, { name: "asc" }],
    take: 300,
  });
  const habis = items.filter((i) => i.stock === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-24 font-semibold">Produk & Stok</h1>
          <p className="text-14 text-muted-foreground">
            Ubah stok / harga di sini → langsung berubah di Shopee / Tokopedia. Stok habis paling atas{habis ? ` (${habis} habis)` : ""}.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <input name="q" defaultValue={q} placeholder="Cari nama / SKU" className="h-9 w-56 rounded-md border bg-card px-2 text-14" />
          <button type="submit" className="h-9 rounded-md border bg-card px-3 text-14 font-medium">Cari</button>
        </form>
      </div>
      <ItemTable
        key={q}
        rows={items.map((i) => ({ id: i.id, platform: i.platform, demo: i.shopId === DEMO, name: i.name, sku: i.sku, price: i.price, stock: i.stock }))}
      />
    </div>
  );
}
