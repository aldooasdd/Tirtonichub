import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import { shippingLabel } from "@/server/marketplace/shopee-logistics";

/** Label / AWB Shopee (PDF). ?sn=ORDER1,ORDER2 (maks 50, kurir sama). */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !s.roles.some(can.manageChannel)) return new NextResponse("Tidak diizinkan.", { status: 403 });
  const sns = (req.nextUrl.searchParams.get("sn") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[A-Z0-9]{6,40}$/.test(x));
  if (!sns.length) return new NextResponse("Nomor pesanan kosong.", { status: 400 });
  const shop = await activeShop("SHOPEE");
  if (!shop || shop.shopId === DEMO) return new NextResponse("Toko Shopee belum tersambung.", { status: 400 });
  try {
    const f = await fresh(shop);
    const file = await shippingLabel({ token: f.accessToken, shopId: f.shopId }, sns);
    return new NextResponse(file.data, {
      headers: { "content-type": file.type, "content-disposition": `inline; filename="label-shopee-${sns.length === 1 ? sns[0] : sns.length}.pdf"`, "cache-control": "no-store" },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Gagal membuat label.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
