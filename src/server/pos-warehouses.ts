import { prisma } from "@/server/db";
import { DEMO, mustShop } from "@/server/marketplace/sync";
import * as shopee from "@/server/marketplace/shopee";
import * as tt from "@/server/marketplace/tiktok-ops";

export type Warehouse = { key: string; platform: string; name: string };

/** Semua gudang Tokopedia & Shopee: id dari stok tersimpan (sync) + nama dari API (kalau gagal, pakai id). */
export async function loadWarehouses(): Promise<Warehouse[]> {
  const seen = await prisma.$queryRaw<{ platform: string; id: string }[]>`
    SELECT DISTINCT platform, w->>'id' AS id
    FROM "MarketplaceItem", jsonb_array_elements("whStock") w
    WHERE "whStock" IS NOT NULL AND jsonb_typeof("whStock") = 'array'`;
  const names = new Map<string, string>();
  await Promise.all([
    mustShop("TOKOPEDIA")
      .then(async (s) => {
        if (s.shopId === DEMO) return;
        for (const w of await tt.warehouses({ token: s.accessToken, cipher: s.cipher ?? "" })) names.set(`TOKOPEDIA:${w.id}`, w.name);
      })
      .catch(() => {}),
    mustShop("SHOPEE")
      .then(async (s) => {
        if (s.shopId === DEMO) return;
        for (const [id, n] of await shopee.shopeeWarehouseNames(s.accessToken, s.shopId)) names.set(`SHOPEE:${id}`, n);
      })
      .catch(() => {}),
  ]);
  const keys = new Set([...seen.map((r) => `${r.platform}:${r.id}`), ...names.keys()]);
  const label = (k: string) => {
    const [plat, id] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
    return { key: k, platform: plat === "TOKOPEDIA" ? "Tokopedia" : "Shopee", name: names.get(k) ?? (id ? `Gudang ${id}` : "Gudang utama") };
  };
  return [...keys].map(label).sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name));
}
