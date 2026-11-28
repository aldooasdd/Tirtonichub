import { NextResponse, type NextRequest } from "next/server";
import { parseMeta, sahMeta, simpanPesan } from "@/server/meta-inbox";

/** Verifikasi URL webhook dari dashboard Meta (hub.challenge). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

/** Pesan WA + IG masuk (juga balasan admin dari HP) → Inbox. Ditandatangani META_APP_SECRET. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!sahMeta(body, req.headers.get("x-hub-signature-256"))) return new NextResponse("bad signature", { status: 401 });
  try {
    await simpanPesan(parseMeta(JSON.parse(body)));
  } catch (e) {
    console.error("meta webhook", e);
    return new NextResponse("error", { status: 500 }); // Meta mengulang kirim
  }
  return NextResponse.json({ ok: true });
}
