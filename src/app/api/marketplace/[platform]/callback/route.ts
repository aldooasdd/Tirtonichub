import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { sameSig } from "@/server/marketplace/sign";
import { shopeeShopName, shopeeTokenFromCode } from "@/server/marketplace/shopee";
import { tiktokShops, tiktokTokenFromCode } from "@/server/marketplace/tiktok";
import { saveShop, syncItems, syncOrders } from "@/server/marketplace/sync";

// req.url di dalam container = localhost:3000, jadi redirect pakai APP_URL.
const base = () => (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");
const back = (_req: NextRequest, msg: string) => NextResponse.redirect(`${base()}/channel?pesan=${encodeURIComponent(msg)}`);

/** Balikan izin toko dari Shopee / TikTok Shop: tukar code → token, simpan, sinkron awal. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const s = await getSession();
  if (!s || !s.roles.some(can.manageChannel)) return NextResponse.redirect(`${base()}/login`);

  const q = req.nextUrl.searchParams;
  const jar = await cookies();
  const expect = jar.get("mp_state")?.value ?? "";
  jar.delete("mp_state");
  if (!expect || !sameSig(q.get("state") ?? "", expect)) return back(req, "Izin toko kedaluwarsa. Ulangi Sambungkan.");
  const code = q.get("code") ?? "";
  if (!code) return back(req, "Izin toko dibatalkan.");

  try {
    if (platform === "shopee") {
      const shopId = q.get("shop_id") ?? "";
      const t = await shopeeTokenFromCode(code, shopId);
      await saveShop("SHOPEE", { shopId, shopName: await shopeeShopName(t.accessToken, shopId), ...t });
      await syncOrders("SHOPEE", 30).catch(() => null);
      await syncItems("SHOPEE").catch(() => null);
      return back(req, "Shopee tersambung.");
    }
    if (platform === "tokopedia") {
      const t = await tiktokTokenFromCode(code);
      const shop = (await tiktokShops(t.accessToken))[0];
      if (!shop) return back(req, "Akun belum punya toko yang diizinkan.");
      await saveShop("TOKOPEDIA", { shopId: shop.id, shopName: shop.name || t.sellerName, cipher: shop.cipher, accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt });
      await syncOrders("TOKOPEDIA", 30).catch(() => null);
      await syncItems("TOKOPEDIA").catch(() => null);
      return back(req, "Tokopedia tersambung.");
    }
  } catch (e) {
    return back(req, `Gagal sambung: ${e instanceof Error ? e.message : "error"}`);
  }
  return back(req, "Platform tidak dikenal.");
}
