// Kirim berita tenis pagi sekarang (uji / susulan). Hanya Boss & Admin. Buka di browser saat login.
import { getSession } from "@/server/auth/session";
import { kirimBerita } from "@/server/push/berita";

export const maxDuration = 300;

export async function GET() {
  const s = await getSession();
  if (!s?.roles.some((r) => r === "BOSS" || r === "ADMIN")) return Response.json({ ok: false, error: "Hanya Boss / Admin." }, { status: 403 });
  try {
    const sent = await kirimBerita();
    return Response.json({ ok: true, message: `Berita terkirim ke ${sent} nomor WA.` });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Gagal." }, { status: 500 });
  }
}
