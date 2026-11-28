import { NextResponse, type NextRequest } from "next/server";
import { sahMeta, simpanPesan } from "@/server/meta-inbox";
import { parseGowa } from "@/server/gowa-inbox";

/** Pesan WA dari GOWA (instance ke-?akun=n) → Inbox. Ditandatangani GOWA_WEBHOOK_SECRET (X-Hub-Signature-256). */
export async function POST(req: NextRequest) {
  const akun = req.nextUrl.searchParams.get("akun") ?? "1";
  const body = await req.text();
  if (!sahMeta(body, req.headers.get("x-hub-signature-256"), process.env.GOWA_WEBHOOK_SECRET ?? "")) return new NextResponse("bad signature", { status: 401 });
  try {
    const p = JSON.parse(body);
    const ev = parseGowa(p, akun);
    if (ev) await simpanPesan([ev]);
    else if (!p?.event || p.event === "message") console.log("gowa webhook dilewati:", body.slice(0, 300)); // bantu cek format versi GOWA
  } catch (e) {
    console.error("gowa webhook", e);
    return new NextResponse("error", { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
