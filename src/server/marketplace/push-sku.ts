// Kirim SKU Tirtonichub ke Shopee & Tokopedia (seller SKU). Dipakai Produk Master (per varian & Isi SKU massal).
// Tirtonic.com tidak ikut (SKU website dikelola di sana).
import { prisma } from "@/server/db";
import { DEMO, PLATFORM_LABEL, activeShop, fresh } from "@/server/marketplace/sync";
import { call as shopeeCall } from "@/server/marketplace/shopee";
import { productRaw, partialEditProduct } from "@/server/marketplace/tiktok-product";
import { bolehUbah } from "@/lib/flags";

type Line = { id: string; sku: string };

/** Satu produk per panggilan API. Hasil: daftar gagal ("Tokopedia Nama: alasan"). Sukses → sku marketplace ikut diperbarui di DB. */
export async function pushSkus(lines: Line[]): Promise<{ sent: number; fail: string[] }> {
  const items = await prisma.marketplaceItem.findMany({
    where: { id: { in: lines.map((l) => l.id) }, platform: { in: ["SHOPEE", "TOKOPEDIA"] }, shopId: { not: DEMO } },
    select: { id: true, platform: true, itemId: true, modelId: true, name: true },
  });
  const want = new Map(lines.map((l) => [l.id, l.sku.trim()]));
  const byProduct = new Map<string, typeof items>();
  for (const it of items) {
    if (!bolehUbah(it.platform)) continue;
    const k = `${it.platform}:${it.itemId}`;
    (byProduct.get(k) ?? byProduct.set(k, []).get(k)!).push(it);
  }

  const shops = new Map<string, Awaited<ReturnType<typeof fresh>>>();
  const shopOf = async (p: "SHOPEE" | "TOKOPEDIA") => shops.get(p) ?? shops.set(p, await fresh((await activeShop(p))!)).get(p)!;
  let sent = 0;
  const fail: string[] = [];

  // ponytail: 3 produk paralel; naikkan kalau ribuan produk terasa lambat (awas rate limit marketplace).
  const queue = [...byProduct.values()];
  const worker = async () => {
    for (let vs = queue.shift(); vs; vs = queue.shift()) {
      const p = vs[0].platform as "SHOPEE" | "TOKOPEDIA";
      try {
        if (vs.some((v) => /\s/.test(want.get(v.id)!) || want.get(v.id)!.length > 50)) throw new Error("SKU tidak boleh berspasi & maks 50 huruf.");
        const s = await shopOf(p);
        if (p === "SHOPEE") {
          const single = vs.filter((v) => !v.modelId || v.modelId === "0");
          const models = vs.filter((v) => v.modelId && v.modelId !== "0");
          if (single.length)
            await shopeeCall("/api/v2/product/update_item", { token: s.accessToken, shopId: s.shopId, method: "POST", body: { item_id: Number(vs[0].itemId), item_sku: want.get(single[0].id) } });
          if (models.length)
            await shopeeCall("/api/v2/product/update_model", {
              token: s.accessToken,
              shopId: s.shopId,
              method: "POST",
              body: { item_id: Number(vs[0].itemId), model: models.map((m) => ({ model_id: Number(m.modelId), model_sku: want.get(m.id) })) },
            });
        } else {
          const c = { token: s.accessToken, cipher: s.cipher ?? "" };
          const raw = await productRaw(c, vs[0].itemId);
          const skus = raw.skus ?? [];
          // WAJIB kirim semua SKU produk: SKU yang tak dikirim akan DIHAPUS Tokopedia. Stok & harga tidak dikirim (tetap).
          if (!vs.every((v) => skus.some((k) => k.id === v.modelId))) throw new Error("Varian tidak ditemukan di Tokopedia. Sinkron dulu.");
          await partialEditProduct(c, vs[0].itemId, {
            skus: skus.map((k) => ({
              id: k.id,
              seller_sku: vs.find((v) => v.modelId === k.id) ? want.get(vs.find((v) => v.modelId === k.id)!.id) : k.seller_sku,
              ...(k.sales_attributes?.length ? { sales_attributes: k.sales_attributes } : {}),
            })),
          });
        }
        for (const v of vs) {
          const sku = want.get(v.id)!;
          await prisma.marketplaceItem.update({ where: { id: v.id }, data: { sku: sku || null, localSku: null } });
        }
        sent += vs.length;
      } catch (e) {
        fail.push(`${PLATFORM_LABEL[p]} ${vs[0].name.slice(0, 50)}: ${e instanceof Error ? e.message : "gagal"}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { sent, fail };
}
