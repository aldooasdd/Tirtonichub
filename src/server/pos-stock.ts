// Potong stok marketplace setelah transaksi kasir /pos.
// Barang 1 SKU bisa tayang di Tokopedia & Shopee; gudang cabang tercatat di keduanya (stok cerminan),
// jadi qty dikurangi di gudang cabang sumber pada TIAP platform yang gudangnya dipetakan ke cabang itu.
import { prisma } from "@/server/db";
import { DEMO, mustShop } from "@/server/marketplace/sync";
import * as shopee from "@/server/marketplace/shopee";
import * as tt from "@/server/marketplace/tiktok-ops";
import { tiktokSetStock } from "@/server/marketplace/tiktok";
import { bolehUbah } from "@/lib/flags";
import { notifyRole } from "@/server/notify";
import { logActivity } from "@/server/activity-log";
import type { RoleCode } from "@/generated/prisma";

type Wh = { id: string; stock: number };
export type StockLine = { sku: string; qty: number; fromBranchId: string };
type Result = { sku: string; platform: string; warehouse: string; before?: number; after?: number; error?: string };

/** Stok terbaru 1 varian di 1 gudang langsung dari marketplace. */
async function readStock(platform: string, itemId: string, modelId: string, whId: string): Promise<number> {
  const s = await mustShop(platform as "SHOPEE" | "TOKOPEDIA");
  if (platform === "SHOPEE") {
    const rows = await shopee.shopeeLocationStock(s.accessToken, s.shopId, itemId);
    const r = rows.find((x) => x.modelId === modelId) ?? rows[0];
    return r?.locations.find((l) => l.id === whId)?.stock ?? 0;
  }
  const inv = await tt.inventory({ token: s.accessToken, cipher: s.cipher ?? "" }, [itemId]);
  return inv.find((k) => k.skuId === modelId)?.warehouses.find((w) => w.id === whId)?.available ?? 0;
}

async function writeStock(platform: string, itemId: string, modelId: string, whId: string, stock: number) {
  const s = await mustShop(platform as "SHOPEE" | "TOKOPEDIA");
  if (platform === "SHOPEE") await shopee.shopeeSetLocationStock(s.accessToken, s.shopId, itemId, modelId, whId, stock);
  else await tiktokSetStock(s.accessToken, s.cipher ?? "", itemId, modelId, whId || null, stock);
}

/** Jalan di belakang (kasir tak menunggu). Gagal → catat & beri tahu Tirtonic Channel. */
export async function deductPosStock(lines: StockLine[], ctx: { notaNo: string; userId: string; role: RoleCode | undefined }) {
  const results: Result[] = [];
  const branches = await prisma.branch.findMany({ select: { id: true, warehouseIds: true } });
  const whOf = new Map(branches.map((b) => [b.id, new Set(b.warehouseIds)]));

  for (const l of lines) {
    const wh = whOf.get(l.fromBranchId);
    if (!wh?.size || !l.sku) continue;
    const items = await prisma.marketplaceItem.findMany({
      where: {
        deletedAt: null,
        platform: { in: ["TOKOPEDIA", "SHOPEE"] },
        OR: [{ localSku: { equals: l.sku, mode: "insensitive" } }, { localSku: null, sku: { equals: l.sku, mode: "insensitive" } }],
      },
    });
    for (const it of items) {
      if (!bolehUbah(it.platform) || it.shopId === DEMO) continue;
      const list = (it.whStock as Wh[] | null) ?? [];
      // Gudang cabang sumber di platform ini; lebih dari satu → yang stoknya paling banyak.
      const target = list.filter((w) => wh.has(`${it.platform}:${w.id}`)).sort((a, b) => b.stock - a.stock)[0];
      if (!target) continue;
      const r: Result = { sku: l.sku, platform: it.platform, warehouse: target.id };
      try {
        const before = await readStock(it.platform, it.itemId, it.modelId, target.id);
        // ponytail: stok tak pernah minus; kalau kurang, jadi 0 dan dicatat (barang fisik sudah keluar).
        const after = Math.max(0, before - l.qty);
        await writeStock(it.platform, it.itemId, it.modelId, target.id, after);
        await prisma.marketplaceItem.update({
          where: { id: it.id },
          data: { stock: Math.max(0, it.stock - (before - after)), whStock: list.map((w) => (w.id === target.id ? { ...w, stock: after } : w)) },
        });
        Object.assign(r, { before, after });
        if (before < l.qty) r.error = `stok ${before}, terjual ${l.qty}`;
      } catch (e) {
        r.error = e instanceof Error ? e.message : "gagal";
      }
      results.push(r);
    }
  }

  if (ctx.role)
    await logActivity({ userId: ctx.userId, activeRole: ctx.role }, { action: "pos_stok", entity: "SalesReport", entityId: ctx.notaNo, after: { results } }).catch(() => {});
  const bad = results.filter((r) => r.error);
  if (bad.length)
    await notifyRole("CHANNEL", {
      type: "pos_stock",
      title: `Potong stok kasir ${ctx.notaNo}: ${bad.length} perlu dicek`,
      body: bad.map((r) => `${r.sku} (${r.platform === "SHOPEE" ? "Shopee" : "Tokopedia"}): ${r.error}`).join("\n").slice(0, 900),
      link: "/channel/produk",
    }).catch(() => {});
}
