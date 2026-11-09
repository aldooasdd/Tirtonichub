import { NextResponse, type NextRequest } from "next/server";
import { sameSig, shopeePushSig, tiktokPushSig } from "@/server/marketplace/sign";
import { syncOrders } from "@/server/marketplace/sync";

const base = () => (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");

/** Webhook order Shopee / TikTok Shop: cek tanda tangan, lalu tarik order 1 hari terakhir (notif order baru ikut jalan). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const body = await req.text();
  const sig = req.headers.get("authorization") ?? "";

  if (platform === "shopee") {
    // Push ditandatangani "Live Push Partner Key" (console → Push Mechanism → Generate), beda dengan API partner key.
    const key = process.env.SHOPEE_PUSH_KEY || process.env.SHOPEE_PARTNER_KEY || "";
    const url = `${base()}/api/marketplace/shopee/webhook`;
    if (!key || !sameSig(sig, shopeePushSig(key, url, body))) return NextResponse.json({ ok: false }, { status: 401 });
    void syncOrders("SHOPEE", 1).catch(() => null);
    return NextResponse.json({ ok: true });
  }
  if (platform === "tokopedia") {
    const secret = process.env.TIKTOK_APP_SECRET ?? "";
    const appKey = process.env.TIKTOK_APP_KEY ?? "";
    if (!secret || !sameSig(sig, tiktokPushSig(secret, appKey, body))) return NextResponse.json({ ok: false }, { status: 401 });
    void syncOrders("TOKOPEDIA", 1).catch(() => null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 404 });
}
